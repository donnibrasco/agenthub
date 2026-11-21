import { memo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function CodeBlock({ language, children }: { language: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = textOf(children).replace(/\n$/, '');
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#e7e2d9] bg-[#f6f3ed]">
      <div className="flex items-center justify-between border-b border-[#e7e2d9] bg-[#f0ece4] px-3.5 py-1.5 text-xs text-[#665f54]">
        <span className="font-medium">{language || 'code'}</span>
        <button type="button" onClick={async () => { if (await copyText(code)) { setCopied(true); window.setTimeout(() => setCopied(false), 1500); } }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition hover:bg-[#e6e1d7] hover:text-[#282820] focus-visible:outline-2 focus-visible:outline-[#08666c]">
          {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed"><code className="font-mono text-[#282820]">{code}</code></pre>
    </div>
  );
}

const components: Components = {
  p: props => <p className="my-3 first:mt-0 last:mb-0" {...strip(props)} />,
  h1: props => <h3 className="mt-6 mb-2 text-lg font-semibold tracking-tight first:mt-0" {...strip(props)} />,
  h2: props => <h3 className="mt-6 mb-2 text-lg font-semibold tracking-tight first:mt-0" {...strip(props)} />,
  h3: props => <h4 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...strip(props)} />,
  h4: props => <h5 className="mt-4 mb-1.5 font-semibold first:mt-0" {...strip(props)} />,
  ul: props => <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-[#a9a397]" {...strip(props)} />,
  ol: props => <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:text-[#777064]" {...strip(props)} />,
  li: props => <li className="pl-1 [&>ul]:my-1.5 [&>ol]:my-1.5" {...strip(props)} />,
  strong: props => <strong className="font-semibold text-[#1f1f18]" {...strip(props)} />,
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" className="font-medium text-[#08666c] underline decoration-[#08666c]/30 underline-offset-2 hover:decoration-[#08666c]" />,
  blockquote: props => <blockquote className="my-3 border-l-[3px] border-[#cfc8bb] pl-4 text-[#4b4941]" {...strip(props)} />,
  hr: () => <hr className="my-5 border-[#e7e2d9]" />,
  table: props => (
    <div className="my-4 overflow-x-auto rounded-xl border border-[#e7e2d9]">
      <table className="w-full border-collapse text-left text-[13px] [overflow-wrap:normal]" {...strip(props)} />
    </div>
  ),
  thead: props => <thead className="bg-[#f2eee6]" {...strip(props)} />,
  th: props => <th className="border-b border-[#e7e2d9] px-3 py-2 font-semibold whitespace-nowrap" {...strip(props)} />,
  td: props => <td className="min-w-[7rem] border-b border-[#efebe3] px-3 py-2 align-top" {...strip(props)} />,
  tr: props => <tr className="last:[&>td]:border-b-0" {...strip(props)} />,
  pre: ({ children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    const className = (child && typeof child === 'object' && 'props' in child ? (child.props as { className?: string }).className : '') || '';
    return <CodeBlock language={className.replace(/^language-/, '')}>{children}</CodeBlock>;
  },
  code: ({ node: _node, className, ...props }) => className
    ? <code className={className} {...props} />
    : <code className="rounded-md border border-[#e7e2d9] bg-[#f2eee6] px-1.5 py-0.5 font-mono text-[0.86em] text-[#282820]" {...props} />,
  img: ({ node: _node, alt }) => <span className="text-[#665f54]">[image{alt ? `: ${alt}` : ''}]</span>,
  input: ({ node: _node, ...props }) => <input {...props} disabled className="mr-1.5 translate-y-px accent-[#08666c]" />,
};

/** Drops react-markdown's `node` prop so it is not spread onto DOM elements. */
function strip<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const { node: _node, ...rest } = props;
  return rest;
}

/** Renders model output as GitHub-flavored Markdown. Raw HTML is never rendered. */
export const Markdown = memo(function Markdown({ children, className = '', size = 'base' }: { children: string; size?: 'base' | 'sm' } & Pick<ComponentPropsWithoutRef<'div'>, 'className'>) {
  return (
    <div className={`${size === 'sm' ? 'text-sm leading-6' : 'text-[15px] leading-7'} text-[#282820] [overflow-wrap:anywhere] ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{children}</ReactMarkdown>
    </div>
  );
});
