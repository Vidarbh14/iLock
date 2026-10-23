using System;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Threading;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    [SupportedOSPlatform("windows")]
    public static class InputSimulator
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;

        private const int INPUT_MOUSE = 0;
        private const int INPUT_KEYBOARD = 1;

        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

        private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint KEYEVENTF_UNICODE = 0x0004;

        private const ushort VK_RETURN = 0x0D;
        private const ushort VK_ESCAPE = 0x1B;
        private const ushort VK_TAB = 0x09;
        private const ushort VK_BACK = 0x08;
        private const ushort VK_SHIFT = 0x10;
        private const ushort VK_CONTROL = 0x11;
        private const ushort VK_MENU = 0x12; // ALT
        private const ushort VK_LWIN = 0x5B;
        private const ushort VK_F4 = 0x73;
        private const ushort VK_D = 0x44;

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public int type;
            public InputUnion u;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)]
            public MOUSEINPUT mi;
            [FieldOffset(0)]
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        public static bool ExecuteFromJson(string jsonPayload, ILogger? logger = null)
        {
            try
            {
                using var doc = JsonDocument.Parse(jsonPayload);
                var root = doc.RootElement;

                string type = root.TryGetProperty("type", out var tProp) ? tProp.GetString()?.ToLowerInvariant() ?? "" : "";
                if (string.IsNullOrEmpty(type) && root.TryGetProperty("action", out var aProp))
                    type = aProp.GetString()?.ToLowerInvariant() ?? "";
                string button = root.TryGetProperty("button", out var bProp) ? bProp.GetString()?.ToLowerInvariant() ?? "left" : "left";
                double x = root.TryGetProperty("x", out var xProp) ? xProp.GetDouble() : -1;
                double y = root.TryGetProperty("y", out var yProp) ? yProp.GetDouble() : -1;
                int deltaY = root.TryGetProperty("deltaY", out var dProp) ? dProp.GetInt32() : 0;
                string? text = root.TryGetProperty("text", out var txtProp) ? txtProp.GetString() : null;
                string? key = root.TryGetProperty("key", out var kProp) ? kProp.GetString() : null;
                string? macro = root.TryGetProperty("macro", out var mProp) ? mProp.GetString()?.ToUpperInvariant() : null;

                logger?.LogInformation("InputSimulator: type={Type}, button={Button}, x={X:F2}, y={Y:F2}, macro={Macro}", type, button, x, y, macro);

                if (!string.IsNullOrEmpty(macro))
                {
                    return ExecuteMacro(macro, logger);
                }

                switch (type)
                {
                    case "click":
                        if (x >= 0 && y >= 0) MoveMouse(x, y);
                        return ClickMouse(button);

                    case "move":
                        if (x >= 0 && y >= 0) return MoveMouse(x, y);
                        return false;

                    case "scroll":
                        return ScrollMouse(deltaY);

                    case "keystroke":
                        if (!string.IsNullOrEmpty(text))
                        {
                            return SendUnicodeString(text);
                        }
                        if (!string.IsNullOrEmpty(key))
                        {
                            return SendKey(key);
                        }
                        return false;

                    case "macro":
                        return ExecuteMacro(macro ?? "", logger);

                    default:
                        logger?.LogWarning("Unsupported input type: {Type}", type);
                        return false;
                }
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "InputSimulator execution failed");
                return false;
            }
        }

        public static bool MoveMouse(double normalizedX, double normalizedY)
        {
            int screenWidth = GetSystemMetrics(SM_CXSCREEN);
            int screenHeight = GetSystemMetrics(SM_CYSCREEN);
            if (screenWidth <= 0) screenWidth = 1920;
            if (screenHeight <= 0) screenHeight = 1080;

            // Absolute mouse coordinates range from 0 to 65535
            int absX = (int)(Math.Clamp(normalizedX, 0.0, 1.0) * 65535);
            int absY = (int)(Math.Clamp(normalizedY, 0.0, 1.0) * 65535);

            var input = new INPUT
            {
                type = INPUT_MOUSE,
                u = new InputUnion
                {
                    mi = new MOUSEINPUT
                    {
                        dx = absX,
                        dy = absY,
                        dwFlags = MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };

            return SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>()) == 1;
        }

        public static bool ClickMouse(string button = "left")
        {
            uint downFlag = MOUSEEVENTF_LEFTDOWN;
            uint upFlag = MOUSEEVENTF_LEFTUP;

            if (button == "right")
            {
                downFlag = MOUSEEVENTF_RIGHTDOWN;
                upFlag = MOUSEEVENTF_RIGHTUP;
            }
            else if (button == "middle")
            {
                downFlag = MOUSEEVENTF_MIDDLEDOWN;
                upFlag = MOUSEEVENTF_MIDDLEUP;
            }

            var inputs = new INPUT[2];
            inputs[0] = new INPUT { type = INPUT_MOUSE, u = new InputUnion { mi = new MOUSEINPUT { dwFlags = downFlag } } };
            inputs[1] = new INPUT { type = INPUT_MOUSE, u = new InputUnion { mi = new MOUSEINPUT { dwFlags = upFlag } } };

            uint res = SendInput(2, inputs, Marshal.SizeOf<INPUT>());
            if (button == "double")
            {
                Thread.Sleep(50);
                SendInput(2, inputs, Marshal.SizeOf<INPUT>());
            }
            return res == 2;
        }

        public static bool ScrollMouse(int deltaY)
        {
            int wheelDelta = deltaY != 0 ? -deltaY * 120 : -120;
            var input = new INPUT
            {
                type = INPUT_MOUSE,
                u = new InputUnion
                {
                    mi = new MOUSEINPUT
                    {
                        dwFlags = MOUSEEVENTF_WHEEL,
                        mouseData = unchecked((uint)wheelDelta)
                    }
                }
            };
            return SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>()) == 1;
        }

        public static bool SendUnicodeString(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;

            var inputs = new INPUT[text.Length * 2];
            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];
                inputs[i * 2] = new INPUT
                {
                    type = INPUT_KEYBOARD,
                    u = new InputUnion
                    {
                        ki = new KEYBDINPUT { wVk = 0, wScan = c, dwFlags = KEYEVENTF_UNICODE }
                    }
                };
                inputs[i * 2 + 1] = new INPUT
                {
                    type = INPUT_KEYBOARD,
                    u = new InputUnion
                    {
                        ki = new KEYBDINPUT { wVk = 0, wScan = c, dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP }
                    }
                };
            }
            return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>()) == inputs.Length;
        }

        public static bool SendKey(string keyName)
        {
            ushort vk = keyName.ToLowerInvariant() switch
            {
                "enter" or "return" => VK_RETURN,
                "esc" or "escape" => VK_ESCAPE,
                "tab" => VK_TAB,
                "back" or "backspace" => VK_BACK,
                _ => 0
            };

            if (vk == 0 && keyName.Length == 1)
            {
                return SendUnicodeString(keyName);
            }

            if (vk == 0) return false;

            var inputs = new INPUT[2];
            inputs[0] = new INPUT { type = INPUT_KEYBOARD, u = new InputUnion { ki = new KEYBDINPUT { wVk = vk } } };
            inputs[1] = new INPUT { type = INPUT_KEYBOARD, u = new InputUnion { ki = new KEYBDINPUT { wVk = vk, dwFlags = KEYEVENTF_KEYUP } } };
            return SendInput(2, inputs, Marshal.SizeOf<INPUT>()) == 2;
        }

        public static bool ExecuteMacro(string macro, ILogger? logger = null)
        {
            switch (macro)
            {
                case "ALT_F4":
                    // Alt + F4
                    PressKeyCombination(new[] { VK_MENU, VK_F4 });
                    return true;

                case "WIN_D":
                    // Win + D (Toggle desktop)
                    PressKeyCombination(new[] { VK_LWIN, VK_D });
                    return true;

                case "TASK_MGR":
                    // Ctrl + Shift + Esc
                    PressKeyCombination(new[] { VK_CONTROL, VK_SHIFT, VK_ESCAPE });
                    return true;

                case "ENTER":
                    return SendKey("enter");

                case "ESC":
                    return SendKey("esc");

                case "LOCK":
                    WindowsAccessProvider.ExecuteNativeLock();
                    return true;

                default:
                    logger?.LogWarning("Unknown macro: {Macro}", macro);
                    return false;
            }
        }

        private static void PressKeyCombination(ushort[] keys)
        {
            var inputs = new INPUT[keys.Length * 2];
            for (int i = 0; i < keys.Length; i++)
            {
                inputs[i] = new INPUT
                {
                    type = INPUT_KEYBOARD,
                    u = new InputUnion { ki = new KEYBDINPUT { wVk = keys[i] } }
                };
            }
            for (int i = 0; i < keys.Length; i++)
            {
                inputs[keys.Length + i] = new INPUT
                {
                    type = INPUT_KEYBOARD,
                    u = new InputUnion { ki = new KEYBDINPUT { wVk = keys[keys.Length - 1 - i], dwFlags = KEYEVENTF_KEYUP } }
                };
            }
            SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
        }
    }
}
