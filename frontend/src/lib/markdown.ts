import { marked } from "marked";

/**
 * Render admin-authored Markdown to HTML for display.
 *
 * Page bodies are written only by authenticated admins, but we still run a
 * conservative sanitisation pass so a mistaken paste can't inject active
 * content: script/style/iframe/object/embed elements, inline event handlers and
 * `javascript:`/`data:` URLs are stripped. Only formatting markup survives.
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  const raw = marked.parse(md, { async: false }) as string;
  return sanitize(raw);
}

function sanitize(html: string): string {
  return (
    html
      // Drop dangerous elements entirely (with their contents).
      .replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      // Drop self-closing / unterminated dangerous tags.
      .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[^>]*>/gi, "")
      // Strip inline event handlers: on*="..." / on*='...'
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      // Neutralise javascript:/data: URLs in href/src.
      .replace(/(href|src)\s*=\s*"(?:javascript|data):[^"]*"/gi, '$1="#"')
      .replace(/(href|src)\s*=\s*'(?:javascript|data):[^']*'/gi, "$1='#'")
  );
}
