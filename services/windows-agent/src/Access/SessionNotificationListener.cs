using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    /// <summary>
    /// Listens for OS-level session lock, unlock, and logon events using WTSRegisterSessionNotification.
    /// This enables real-time synchronization of workstation lock state even when the user physically
    /// locks (Win + L) or unlocks their PC with their keyboard/Windows Hello.
    /// </summary>
    public class SessionNotificationListener : IDisposable
    {
        private readonly ILogger? _logger;
        private readonly Thread _thread;
        private volatile bool _disposed = false;
        private IntPtr _hWnd = IntPtr.Zero;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr CreateWindowEx(
            uint dwExStyle, string lpClassName, string lpWindowName,
            uint dwStyle, int x, int y, int nWidth, int nHeight,
            IntPtr hWndParent, IntPtr hMenu, IntPtr hInstance, IntPtr lpParam);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool DestroyWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("wtsapi32.dll", SetLastError = true)]
        private static extern bool WTSRegisterSessionNotification(IntPtr hWnd, uint dwFlags);

        [DllImport("wtsapi32.dll", SetLastError = true)]
        private static extern bool WTSUnRegisterSessionNotification(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr DefWindowProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern ushort RegisterClass(ref WNDCLASS lpWndClass);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct WNDCLASS
        {
            public uint style;
            public WndProcDelegate lpfnWndProc;
            public int cbClsExtra;
            public int cbWndExtra;
            public IntPtr hInstance;
            public IntPtr hIcon;
            public IntPtr hCursor;
            public IntPtr hbrBackground;
            public string? lpszMenuName;
            public string lpszClassName;
        }

        private delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
        private WndProcDelegate? _wndProcDelegate;

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public int pt_x;
            public int pt_y;
        }

        private const uint NOTIFY_FOR_ALL_SESSIONS = 1;
        private const uint WM_WTSSESSION_CHANGE = 0x02B1;
        private const int WTS_SESSION_LOCK = 0x7;
        private const int WTS_SESSION_UNLOCK = 0x8;
        private const int WTS_SESSION_LOGON = 0x5;
        private const int WTS_SESSION_LOGOFF = 0x6;
        private const uint WM_CLOSE = 0x0010;

        public SessionNotificationListener(ILogger? logger = null)
        {
            _logger = logger;
            _thread = new Thread(WindowThreadProc)
            {
                IsBackground = true,
                Name = "iLock-SessionNotificationListener"
            };
            _thread.Start();
        }

        private void WindowThreadProc()
        {
            try
            {
                string className = "iLockSessionNotifier_" + Guid.NewGuid().ToString("N");
                _wndProcDelegate = CustomWndProc;
                var wc = new WNDCLASS
                {
                    lpfnWndProc = _wndProcDelegate,
                    lpszClassName = className
                };

                ushort atom = RegisterClass(ref wc);
                if (atom == 0)
                {
                    _logger?.LogWarning("RegisterClass failed for SessionNotificationListener: {Err}", Marshal.GetLastWin32Error());
                    return;
                }

                _hWnd = CreateWindowEx(
                    0,
                    className,
                    "iLockSessionWindow",
                    0, 0, 0, 0, 0,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero
                );

                if (_hWnd == IntPtr.Zero)
                {
                    _logger?.LogWarning("CreateWindowEx failed for SessionNotificationListener: {Err}", Marshal.GetLastWin32Error());
                    return;
                }

                bool registered = WTSRegisterSessionNotification(_hWnd, NOTIFY_FOR_ALL_SESSIONS);
                _logger?.LogInformation("WTSRegisterSessionNotification result: {Registered} (hWnd={Hwnd})", registered, _hWnd);

                while (!_disposed && GetMessage(out MSG msg, IntPtr.Zero, 0, 0) > 0)
                {
                    DispatchMessage(ref msg);
                }

                if (_hWnd != IntPtr.Zero)
                {
                    WTSUnRegisterSessionNotification(_hWnd);
                    DestroyWindow(_hWnd);
                    _hWnd = IntPtr.Zero;
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "SessionNotificationListener thread error");
            }
        }

        private IntPtr CustomWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
        {
            if (msg == WM_WTSSESSION_CHANGE)
            {
                int eventType = wParam.ToInt32();
                int sessionId = lParam.ToInt32();
                string stateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                if (!Directory.Exists(stateDir)) Directory.CreateDirectory(stateDir);
                string stateFile = Path.Combine(stateDir, "lock_state.txt");

                _logger?.LogInformation("WM_WTSSESSION_CHANGE: Event=0x{Event:X}, SessionId={Sess}", eventType, sessionId);

                if (eventType == WTS_SESSION_LOCK)
                {
                    try
                    {
                        File.WriteAllText(stateFile, "LOCKED");
                        _logger?.LogInformation("Hardware lock detected (Win+L / sleep). State updated to LOCKED.");
                    }
                    catch { }
                }
                else if (eventType == WTS_SESSION_UNLOCK || eventType == WTS_SESSION_LOGON)
                {
                    try
                    {
                        File.WriteAllText(stateFile, "UNLOCKED");
                        _logger?.LogInformation("Hardware unlock detected (PIN / Hello / logon). State updated to UNLOCKED.");
                    }
                    catch { }
                }
            }
            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                if (_hWnd != IntPtr.Zero)
                {
                    PostMessage(_hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                }
            }
        }
    }
}
