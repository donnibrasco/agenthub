import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, FileCode2, FileText, Film, X } from 'lucide-react';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, discardAttachment, formatBytes, uploadAttachment, type JobAttachment } from '../lib/attachments';

export interface PendingFile {
  key: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  attachment?: JobAttachment;
  error?: string;
  controller: AbortController;
}

const isImage = (file: File) => /^image\/(png|jpe?g|gif|webp)$/.test(file.type);

/** Uploads files as soon as they are added, so sending is instant. */
export function useAttachments() {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const filesRef = useRef(files);
  filesRef.current = files;

  // Revoke previews and drop unsent uploads when the composer goes away.
  useEffect(() => () => {
    for (const item of filesRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      item.controller.abort();
    }
  }, []);

  const update = (key: string, patch: Partial<PendingFile>) => setFiles(list => list.map(item => (item.key === key ? { ...item, ...patch } : item)));

  const add = useCallback((incoming: FileList | File[]) => {
    const room = MAX_ATTACHMENTS - filesRef.current.length;
    const accepted = Array.from(incoming).slice(0, Math.max(0, room));
    const next: PendingFile[] = accepted.map(file => {
      const tooBig = file.size > MAX_ATTACHMENT_BYTES;
      return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: isImage(file) && !tooBig ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: tooBig ? 'error' : 'uploading',
        error: tooBig ? 'Over 25 MB' : undefined,
        controller: new AbortController(),
      };
    });
    if (incoming.length > accepted.length) {
      next.push({ key: `limit-${Date.now()}`, file: new File([], `Only ${MAX_ATTACHMENTS} files per chat`), progress: 0, status: 'error', error: 'Limit reached', controller: new AbortController() });
    }
    setFiles(list => [...list, ...next]);
    for (const item of next) {
      if (item.status !== 'uploading') continue;
      uploadAttachment(item.file, progress => update(item.key, { progress }), item.controller.signal)
        .then(attachment => update(item.key, { status: 'done', progress: 1, attachment }))
        .catch((error: unknown) => {
          if ((error as Error).name === 'AbortError') return;
          update(item.key, { status: 'error', error: error instanceof Error ? error.message : 'Upload failed' });
        });
    }
  }, []);

  const remove = useCallback((key: string) => {
    setFiles(list => {
      const item = list.find(entry => entry.key === key);
      if (item) {
        item.controller.abort();
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.attachment) discardAttachment(item.attachment.id);
      }
      return list.filter(entry => entry.key !== key);
    });
  }, []);

  /** Forget the files after they were sent (they now belong to the job). */
  const clear = useCallback(() => {
    for (const item of filesRef.current) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setFiles([]);
  }, []);

  return {
    files,
    add,
    remove,
    clear,
    uploading: files.some(item => item.status === 'uploading'),
    readyIds: files.flatMap(item => (item.status === 'done' && item.attachment ? [item.attachment.id] : [])),
  };
}

function FileIcon({ file }: { file: File }) {
  if (file.type.startsWith('video/')) return <Film aria-hidden="true" className="size-5 text-[#5b4bb0]" />;
  if (/\.(js|jsx|ts|tsx|py|go|rs|java|c|cpp|rb|php|sh|sql|json|ya?ml|html|css)$/i.test(file.name)) return <FileCode2 aria-hidden="true" className="size-5 text-[#2f5d8a]" />;
  return <FileText aria-hidden="true" className="size-5 text-[#8a6418]" />;
}

/** The row of attached files shown inside the composer. */
export function AttachmentTray({ files, onRemove }: { files: PendingFile[]; onRemove: (key: string) => void }) {
  if (!files.length) return null;
  return (
    <ul aria-label="Attached files" className="flex flex-wrap gap-2">
      {files.map(item => (
        <li key={item.key} className={`group relative flex h-16 max-w-[15rem] items-center gap-2.5 overflow-hidden rounded-2xl border pr-8 ${item.status === 'error' ? 'border-[#a44e32]/30 bg-[#f9ece4]' : 'border-[#e7e2d9] bg-[#f6f3ed]'} ${item.previewUrl ? 'pl-0' : 'pl-3'}`}>
          {item.previewUrl
            ? <img src={item.previewUrl} alt="" className="h-16 w-16 shrink-0 object-cover" />
            : item.status === 'error' ? <AlertCircle aria-hidden="true" className="size-5 shrink-0 text-[#922d1d]" /> : <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fffdfa]"><FileIcon file={item.file} /></span>}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[#282820]">{item.file.name}</span>
            <span className={`block text-xs ${item.status === 'error' ? 'text-[#922d1d]' : 'text-[#8a8478]'}`}>
              {item.status === 'error' ? item.error : item.status === 'uploading' ? `Uploading ${Math.round(item.progress * 100)}%` : formatBytes(item.file.size)}
            </span>
          </span>
          {item.status === 'uploading' && (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[#e7e2d9]">
              <span className="block h-full bg-[#08666c] transition-[width]" style={{ width: `${Math.max(4, item.progress * 100)}%` }} />
            </span>
          )}
          <button type="button" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.file.name}`}
            className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-[#282820]/75 text-white opacity-90 transition hover:bg-[#282820] focus-visible:outline-2 focus-visible:outline-[#08666c] sm:opacity-0 sm:group-hover:opacity-90 sm:focus-visible:opacity-100">
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
