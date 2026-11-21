import { Download, FileCode2, FileText } from 'lucide-react';
import { attachmentUrl, formatBytes, type JobAttachment } from '../lib/attachments';

/** Files sent with a message: image grid, inline video players, and download chips. */
export function MessageAttachments({ attachments }: { attachments: JobAttachment[] }) {
  if (!attachments.length) return null;
  const images = attachments.filter(a => a.kind === 'image');
  const videos = attachments.filter(a => a.kind === 'video');
  const files = attachments.filter(a => a.kind !== 'image' && a.kind !== 'video');
  return (
    <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-[75%]">
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map(image => (
            <a key={image.id} href={attachmentUrl(image.id)} target="_blank" rel="noreferrer" title={image.name}
              className="block overflow-hidden rounded-2xl border border-[#e7e2d9] bg-[#f2eee6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08666c]">
              <img src={attachmentUrl(image.id)} alt={image.name} loading="lazy"
                className={`block object-cover transition hover:opacity-90 ${images.length === 1 ? 'max-h-80 w-auto max-w-full' : 'aspect-square w-40 sm:w-48'}`} />
            </a>
          ))}
        </div>
      )}
      {videos.map(video => (
        <video key={video.id} src={attachmentUrl(video.id)} controls preload="metadata" aria-label={video.name}
          className="max-h-80 w-full max-w-md rounded-2xl border border-[#e7e2d9] bg-black" />
      ))}
      {files.length > 0 && (
        <ul className="flex flex-wrap justify-end gap-2">
          {files.map(file => (
            <li key={file.id}>
              <a href={attachmentUrl(file.id, true)} title={`Download ${file.name}`}
                className="group flex max-w-[16rem] items-center gap-2.5 rounded-2xl border border-[#e7e2d9] bg-[#fffdfa] py-2 pr-3 pl-2.5 transition hover:border-[#cfc8bb] focus-visible:outline-2 focus-visible:outline-[#08666c]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2eee6]">
                  {file.kind === 'text' ? <FileCode2 aria-hidden="true" className="size-5 text-[#2f5d8a]" /> : <FileText aria-hidden="true" className="size-5 text-[#8a6418]" />}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-medium text-[#282820]">{file.name}</span>
                  <span className="block text-xs text-[#8a8478]">{formatBytes(file.size)}</span>
                </span>
                <Download aria-hidden="true" className="size-4 shrink-0 text-[#a9a397] transition group-hover:text-[#4b4941]" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
