import { Link } from "react-email";

import type { Rich } from "../emailTypes";
import { useEmailPalette } from "./emailRenderContext";

export function RichText({ value }: { readonly value: Rich }) {
  const palette = useEmailPalette();
  if (typeof value === "string") return <>{value}</>;
  return (
    <>
      {value.map((part, index) => {
        if (typeof part === "string") return <span key={index}>{part}</span>;
        if ("strong" in part) return <strong key={index} style={{ fontWeight: 700 }}>{part.strong}</strong>;
        return (
          <Link key={index} href={part.href} className="zm-brand" style={{ color: palette.brand, textDecoration: "underline", fontWeight: 600 }}>
            {part.link}
          </Link>
        );
      })}
    </>
  );
}

export function richToText(value: Rich): string {
  if (typeof value === "string") return value;
  return value.map((part) => (typeof part === "string" ? part : "strong" in part ? part.strong : `${part.link} (${part.href})`)).join("");
}
