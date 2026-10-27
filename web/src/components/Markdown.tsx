import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo, type MouseEvent } from 'react';
import { openLink } from '../tg';

marked.setOptions({ gfm: true, breaks: true });

export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source ?? '', { async: false })), [source]);

  // Route links through Telegram so they open in the in-app browser / Telegram.
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a?.href) return;
    e.preventDefault();
    openLink(a.href);
  };

  return <div className="prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
