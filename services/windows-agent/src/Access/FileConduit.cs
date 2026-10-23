using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Versioning;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    [SupportedOSPlatform("windows")]
    public static class FileConduit
    {
        public class FileItem
        {
            public string Name { get; set; } = string.Empty;
            public long SizeBytes { get; set; }
            public string Extension { get; set; } = string.Empty;
            public DateTime ModifiedAt { get; set; }
        }

        public static string ResolveFolderPath(string folder)
        {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return folder.ToLowerInvariant() switch
            {
                "documents" => Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "downloads" => Path.Combine(userProfile, "Downloads"),
                _ => Environment.GetFolderPath(Environment.SpecialFolder.Desktop)
            };
        }

        public static string ListFilesJson(string folder, ILogger? logger = null)
        {
            try
            {
                string targetDir = ResolveFolderPath(folder);
                if (!Directory.Exists(targetDir)) return "[]";

                var dirInfo = new DirectoryInfo(targetDir);
                var files = dirInfo.GetFiles()
                    .OrderByDescending(f => f.LastWriteTimeUtc)
                    .Take(40)
                    .Select(f => new FileItem
                    {
                        Name = f.Name,
                        SizeBytes = f.Length,
                        Extension = f.Extension.TrimStart('.').ToLowerInvariant(),
                        ModifiedAt = f.LastWriteTimeUtc
                    })
                    .ToList();

                return JsonSerializer.Serialize(files);
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Failed to list files in folder {Folder}", folder);
                return "[]";
            }
        }

        public static (bool Success, string? Base64, string Message) ReadFileBase64(string folder, string fileName, ILogger? logger = null)
        {
            try
            {
                string cleanName = Path.GetFileName(fileName);
                string targetPath = Path.Combine(ResolveFolderPath(folder), cleanName);

                if (!File.Exists(targetPath))
                {
                    return (false, null, $"File '{cleanName}' not found in {folder}");
                }

                var fileInfo = new FileInfo(targetPath);
                if (fileInfo.Length > 15 * 1024 * 1024)
                {
                    return (false, null, "File exceeds maximum 15 MB download limit");
                }

                byte[] bytes = File.ReadAllBytes(targetPath);
                string b64 = Convert.ToBase64String(bytes);
                logger?.LogInformation("Successfully read file {Name} ({Bytes} bytes)", cleanName, bytes.Length);
                return (true, b64, "Success");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error reading file {Name}", fileName);
                return (false, null, ex.Message);
            }
        }

        public static (bool Success, string Message) WriteFileBase64(string folder, string fileName, string base64Data, ILogger? logger = null)
        {
            try
            {
                string cleanName = Path.GetFileName(fileName);
                string targetDir = ResolveFolderPath(folder);
                if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);

                string targetPath = Path.Combine(targetDir, cleanName);
                byte[] bytes = Convert.FromBase64String(base64Data);

                if (bytes.Length > 20 * 1024 * 1024)
                {
                    return (false, "File exceeds 20 MB upload threshold");
                }

                File.WriteAllBytes(targetPath, bytes);
                logger?.LogInformation("Successfully wrote file {Name} to {Dir} ({Bytes} bytes)", cleanName, targetDir, bytes.Length);
                return (true, $"Saved '{cleanName}' ({bytes.Length / 1024} KB) to {folder}");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error writing file {Name}", fileName);
                return (false, ex.Message);
            }
        }
    }
}
