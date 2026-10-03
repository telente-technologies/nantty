import type { ReactNode } from "react";

import styles from "./legal.module.css";

function renderInlineEmphasis(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((piece, index) => (piece.startsWith("**") && piece.endsWith("**") ? <strong key={index}>{piece.slice(2, -2)}</strong> : piece));
}

function renderBlocks(markdown: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let bulletItems: string[] = [];
  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{bulletItems.map((item, index) => <li key={index}>{renderInlineEmphasis(item)}</li>)}</ul>);
    bulletItems = [];
  };
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (/^[-*] /.test(trimmed)) {
      bulletItems.push(trimmed.slice(2));
      continue;
    }
    flushBullets();
    if (trimmed.startsWith("### ")) blocks.push(<h3 key={blocks.length}>{trimmed.slice(4)}</h3>);
    else if (trimmed.startsWith("## ")) blocks.push(<h2 key={blocks.length}>{trimmed.slice(3)}</h2>);
    else if (trimmed.startsWith("# ")) blocks.push(<h1 key={blocks.length}>{trimmed.slice(2)}</h1>);
    else if (trimmed) blocks.push(<p key={blocks.length}>{renderInlineEmphasis(trimmed)}</p>);
  }
  flushBullets();
  return blocks;
}

export function LegalMarkdownPreview({ markdown, label = "Preview" }: { readonly markdown: string; readonly label?: string }) {
  return <div className={styles.preview} role="region" aria-label={label}>{renderBlocks(markdown)}</div>;
}
