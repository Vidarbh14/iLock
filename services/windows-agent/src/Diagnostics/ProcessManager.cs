using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.Versioning;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Diagnostics
{
    [SupportedOSPlatform("windows")]
    public static class ProcessManager
    {
        private static readonly HashSet<string> ProtectedProcesses = new(StringComparer.OrdinalIgnoreCase)
        {
            "csrss",
            "services",
            "lsass",
            "winlogon",
            "smss",
            "svchost",
            "system",
            "registry",
            "ilockagent",
            "ilock.windowsagent"
        };

        public class ProcessSummary
        {
            public int Pid { get; set; }
            public string Name { get; set; } = string.Empty;
            public string Title { get; set; } = string.Empty;
            public long MemoryMb { get; set; }
            public bool CanKill { get; set; }
        }

        public static string GetTopProcessesJson(int limit = 15, ILogger? logger = null)
        {
            try
            {
                var list = new List<ProcessSummary>();
                var processes = Process.GetProcesses();

                foreach (var p in processes)
                {
                    try
                    {
                        string name = p.ProcessName;
                        long memMb = p.WorkingSet64 / (1024 * 1024);
                        string title = string.Empty;
                        try { title = p.MainWindowTitle; } catch { }

                        list.Add(new ProcessSummary
                        {
                            Pid = p.Id,
                            Name = name,
                            Title = title,
                            MemoryMb = memMb,
                            CanKill = !ProtectedProcesses.Contains(name) && p.Id > 4
                        });
                    }
                    catch { }
                }

                var top = list
                    .OrderByDescending(x => !string.IsNullOrEmpty(x.Title)) // Interactive apps first
                    .ThenByDescending(x => x.MemoryMb)
                    .Take(limit)
                    .ToList();

                return JsonSerializer.Serialize(top);
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Failed to collect process list");
                return "[]";
            }
        }

        public static (bool Success, string Message) KillProcess(int pid, ILogger? logger = null)
        {
            if (pid <= 4)
            {
                return (false, "Cannot terminate critical system kernel processes");
            }

            try
            {
                var proc = Process.GetProcessById(pid);
                if (ProtectedProcesses.Contains(proc.ProcessName))
                {
                    return (false, $"Process '{proc.ProcessName}' is system-protected and cannot be terminated.");
                }

                string name = proc.ProcessName;
                proc.Kill(entireProcessTree: true);
                logger?.LogInformation("Successfully terminated process {Name} (PID={Pid})", name, pid);
                return (true, $"Terminated '{name}' (PID: {pid})");
            }
            catch (ArgumentException)
            {
                return (false, $"Process ID {pid} is no longer running");
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "Failed to terminate process PID={Pid}", pid);
                return (false, $"Error killing process {pid}: {ex.Message}");
            }
        }
    }
}
