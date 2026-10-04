import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./help.module.css";

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(inlinePattern).map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={index}>{piece.slice(2, -2)}</strong>;
    if (piece.startsWith("`") && piece.endsWith("`")) return <code key={index}>{piece.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(piece);
    if (link) {
      const href = link[2] ?? "";
      if (href.startsWith("/")) return <Link key={index} href={href}>{link[1]}</Link>;
      if (/^https:\/\/\S+$/.test(href)) return <a key={index} href={href} target="_blank" rel="noopener noreferrer nofollow">{link[1]}</a>;
      return <span key={index}>{link[1]}</span>;
    }
    if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) return <em key={index}>{piece.slice(1, -1)}</em>;
    return piece;
  });
}

function renderTable(rows: readonly string[], key: number): ReactNode {
  const cells = rows.filter((row) => !/^\|\s*-/.test(row)).map((row) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const [header = [], ...body] = cells;
  return (
    <div key={key} className={styles.tableWrap}>
      <table>
        <thead><tr>{header.map((cell, index) => <th key={index} scope="col">{renderInline(cell)}</th>)}</tr></thead>
        <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{renderInline(cell)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function HelpMarkdown({ markdown }: { readonly markdown: string }) {
  const blocks: ReactNode[] = [];
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (line === "") continue;
    const collect = (test: (value: string) => boolean) => {
      const items: string[] = [];
      while (index < lines.length && test((lines[index] ?? "").trim())) items.push((lines[index++] ?? "").trim());
      index -= 1;
      return items;
    };
    if (line.startsWith("|")) blocks.push(renderTable(collect((value) => value.startsWith("|")), blocks.length));
    else if (/^[-*] /.test(line)) blocks.push(<ul key={blocks.length}>{collect((value) => /^[-*] /.test(value)).map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.slice(2))}</li>)}</ul>);
    else if (/^\d+\. /.test(line)) blocks.push(<ol key={blocks.length}>{collect((value) => /^\d+\. /.test(value)).map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.replace(/^\d+\. /, ""))}</li>)}</ol>);
    else if (line.startsWith("### ")) blocks.push(<h4 key={blocks.length}>{renderInline(line.slice(4))}</h4>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={blocks.length}>{renderInline(line.slice(3))}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={blocks.length}>{renderInline(line.slice(2))}</h2>);
    else blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
  }
  return <div className={styles.article}>{blocks}</div>;
}

export function summariseMarkdown(markdown: string, maximum = 155): string {
  const text = markdown.replace(/^#+\s.*$/gm, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`>|#-]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maximum ? `${text.slice(0, maximum - 1).trimEnd()}…` : text;
}
