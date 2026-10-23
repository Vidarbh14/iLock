'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  Download,
  Upload,
  RefreshCw,
  X,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  ArrowDownToLine,
  CloudUpload,
} from 'lucide-react';

interface FileItem {
  name: string;
  size: number;
  modified: string;
  folder: string;
  isDir?: boolean;
}

interface FileConduitModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

export function FileConduitModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}: FileConduitModalProps) {
  const [folder, setFolder] = useState<'desktop' | 'documents' | 'downloads'>('desktop');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async (targetFolder = folder) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/files?folder=${targetFolder}`);
      const data = await res.json();
      if (res.ok && data.files) {
        setFiles(data.files);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to list files' });
    } finally {
      setIsLoading(false);
    }
  };

  const requestFolderScan = async (targetFolder = folder) => {
    setIsLoading(true);
    setMessage(null);
    try {
      await fetch(`/api/devices/${deviceId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', folder: targetFolder }),
      });
      setTimeout(() => fetchFiles(targetFolder), 1200);
      setTimeout(() => fetchFiles(targetFolder), 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to scan directory' });
      setIsLoading(false);
    }
  };

  const handleDownload = async (fileName: string) => {
    setDownloadingName(fileName);
    setMessage(null);

    try {
      // 1. Dispatch read command to agent
      await fetch(`/api/devices/${deviceId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', folder, fileName }),
      });

      // 2. Poll for base64 response
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`/api/devices/${deviceId}/files?action=read&folder=${folder}&fileName=${encodeURIComponent(fileName)}`);
          const data = await res.json();
          if (data.contentBase64) {
            clearInterval(poll);
            setDownloadingName(null);

            // Trigger browser download
            const link = document.createElement('a');
            link.href = `data:application/octet-stream;base64,${data.contentBase64}`;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setMessage({ type: 'success', text: `Downloaded "${fileName}" successfully` });
          } else if (attempts >= 6) {
            clearInterval(poll);
            setDownloadingName(null);
            setMessage({ type: 'error', text: 'File retrieval timed out. Ensure PC is unlocked and reachable.' });
          }
        } catch {
          if (attempts >= 6) {
            clearInterval(poll);
            setDownloadingName(null);
          }
        }
      }, 1000);
    } catch (err: any) {
      setDownloadingName(null);
      setMessage({ type: 'error', text: err.message || 'Download request failed' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File exceeds 20MB limit.' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;

        const res = await fetch(`/api/devices/${deviceId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'write',
            folder,
            fileName: file.name,
            contentBase64: base64,
          }),
        });

        if (res.ok) {
          setMessage({ type: 'success', text: `Uploaded "${file.name}" to PC ${folder} folder!` });
          setTimeout(() => fetchFiles(folder), 1500);
        } else {
          setMessage({ type: 'error', text: 'Failed to upload file to workstation' });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Upload failed' });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      setMessage({ type: 'error', text: 'Could not read local file.' });
    };

    reader.readAsDataURL(file);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || ext === 'docx' || ext === 'txt') return <FileText className="w-4 h-4 text-cyan-400" />;
    if (ext === 'xlsx' || ext === 'csv') return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (ext === 'zip' || ext === 'kdbx' || ext === 'rar') return <FileArchive className="w-4 h-4 text-amber-400" />;
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return <FileImage className="w-4 h-4 text-teal-400" />;
    return <FileCode className="w-4 h-4 text-slate-400" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles(folder);
      requestFolderScan(folder);
    }
  }, [isOpen, folder, deviceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-cyber-card border border-cyber-border rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Remote File Conduit
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Sandboxed
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {deviceName} • Scoped Drop & Document Fetcher
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Scoped Folder Tabs & Upload Action */}
        <div className="flex items-center justify-between gap-3 my-4 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-cyber-border">
            {(['desktop', 'documents', 'downloads'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  folder === f
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              {isUploading ? 'Uploading...' : 'Drop File to PC'}
            </button>
            <button
              onClick={() => requestFolderScan(folder)}
              disabled={isLoading}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors"
              title="Rescan Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {files.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              Folder is empty or awaiting scan.
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {formatBytes(file.size)} • {new Date(file.modified).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(file.name)}
                  disabled={downloadingName === file.name}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
                >
                  {downloadingName === file.name ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-cyber-border flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Conduit sandboxed strictly to Desktop, Documents & Downloads folders.</span>
          <span>Max 20MB / transfer</span>
        </div>
      </div>
    </div>
  );
}
