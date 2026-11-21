export interface JobAttachment {
  id: string;
  jobId: string | null;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'video' | 'text' | 'file';
  createdAt: string;
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export const attachmentUrl = (id: string, download = false) => `/api/uploads/${encodeURIComponent(id)}${download ? '?download' : ''}`;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Uploads one file with progress. Resolves with the stored attachment. */
export function uploadAttachment(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<JobAttachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads');
    // Always octet-stream: the server works out the real type from the bytes.
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    xhr.onload = () => {
      let data: { attachment?: JobAttachment; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* handled below */ }
      if (xhr.status === 201 && data.attachment) resolve(data.attachment);
      else reject(new Error(data.error || (xhr.status === 413 ? 'Files can be up to 25 MB.' : `Upload failed (${xhr.status}).`)));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export function discardAttachment(id: string) {
  void fetch(attachmentUrl(id), { method: 'DELETE' }).catch(() => {});
}
