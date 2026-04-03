import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Public } from '../auth/public.decorator';

const DOC_PATH = join(process.cwd(), 'docs', 'partner-api.md');
let cachedHtml: string | null = null;

// Serves partner API documentation as a styled HTML page.
@Controller('partner')
export class PartnerDocsController {
  @Get('docs')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocs(): string {
    if (!cachedHtml) {
      const markdown = readFileSafe(DOC_PATH);
      cachedHtml = renderHtml(markdown);
    }
    return cachedHtml;
  }
}

// Reads markdown from disk with a fallback message on error.
function readFileSafe(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '# Partner API Documentation\n\nDocumentation file not found.';
  }
}

// Converts markdown to HTML with a minimal subset for the docs page.
function renderHtml(markdown: string): string {
  const content = markdownToHtml(markdown);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Partner API Documentation</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: 'Inter', 'Manrope', system-ui, -apple-system, sans-serif;
        background: #0b1120;
        color: #e2e8f0;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 48px 24px 72px;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 32px;
      }
      header h1 {
        font-size: 24px;
        margin: 0;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
      }
      header span {
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.15);
        color: #86efac;
        font-weight: 600;
      }
      h1, h2, h3, h4 {
        color: #f8fafc;
        margin-top: 32px;
      }
      h1 { font-size: 32px; margin-top: 0; }
      h2 { font-size: 24px; }
      h3 { font-size: 18px; }
      p, li {
        line-height: 1.7;
        color: rgba(226, 232, 240, 0.85);
      }
      code {
        font-family: 'Fira Mono', 'SFMono-Regular', Consolas, monospace;
        background: rgba(148, 163, 184, 0.15);
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 0.9em;
      }
      pre {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
        padding: 16px;
        overflow-x: auto;
      }
      pre code {
        background: transparent;
        padding: 0;
        color: #e2e8f0;
        font-size: 0.85em;
      }
      a {
        color: #38bdf8;
        text-decoration: none;
      }
      a:hover { text-decoration: underline; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
      }
      th, td {
        border: 1px solid rgba(148, 163, 184, 0.2);
        padding: 8px 12px;
        text-align: left;
      }
      th {
        background: rgba(30, 41, 59, 0.9);
        color: #f8fafc;
      }
      ul, ol {
        padding-left: 20px;
      }
      blockquote {
        border-left: 4px solid rgba(34, 197, 94, 0.6);
        padding-left: 12px;
        margin: 16px 0;
        color: rgba(226, 232, 240, 0.8);
      }
      .toc {
        margin: 24px 0;
        padding: 16px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Partner API</h1>
        <span>Insurer Access</span>
      </header>
      ${content}
    </div>
  </body>
</html>`;
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let currentList: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    output.push(`<p>${inlineFormat(escapeHtml(paragraph.join(' ')))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!currentList) {
      return;
    }
    output.push(`</${currentList}>`);
    currentList = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      flushParagraph();
      closeList();
      if (inCodeBlock) {
        output.push('</code></pre>');
        inCodeBlock = false;
      } else {
        const language = line.replace('```', '').trim();
        output.push(`<pre><code class="language-${escapeHtml(language)}">`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      output.push(escapeHtml(rawLine));
      continue;
    }

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.*)/.exec(line);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const text = inlineFormat(escapeHtml(headingMatch[2]));
      output.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)/.exec(line);
    if (ulMatch) {
      flushParagraph();
      if (!currentList) {
        currentList = 'ul';
        output.push('<ul>');
      }
      output.push(`<li>${inlineFormat(escapeHtml(ulMatch[1]))}</li>`);
      continue;
    }

    const olMatch = /^\d+\.\s+(.*)/.exec(line);
    if (olMatch) {
      flushParagraph();
      if (!currentList) {
        currentList = 'ol';
        output.push('<ol>');
      }
      output.push(`<li>${inlineFormat(escapeHtml(olMatch[1]))}</li>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      closeList();
      output.push(`<blockquote>${inlineFormat(escapeHtml(line.slice(2)))}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();

  if (inCodeBlock) {
    output.push('</code></pre>');
  }

  return output.join('\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
