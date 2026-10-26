"use client";

import { buildEmbedFrameUrl, buildEmbedSnippet, embedPreviewSandbox, type EmbedSnippetKind, type EmbedSnippetLayout, type EmbedSnippetTheme } from "@nantty/web-kit";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { CodeIcon, CopyIcon } from "@/components/ui/icons";

import { readProductIdFromNanttyLink } from "./embedProductLink.util";
import styles from "./embedBuilder.module.css";

const embedOrigin = (process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://web.nantty.com").replace(/\/+$/, "");
const kinds: readonly { readonly value: EmbedSnippetKind; readonly label: string; readonly needsStore: boolean }[] = [
  { value: "button", label: "Buy button", needsStore: false }, { value: "store", label: "Store card", needsStore: true }, { value: "products", label: "Products", needsStore: true },
];

function ChoiceGroup<Value extends string>({ options, value, onChange }: { readonly options: readonly { readonly value: Value; readonly label: string; readonly disabled?: boolean }[]; readonly value: Value; readonly onChange: (value: Value) => void }) {
  return (
    <div className={styles.choices}>
      {options.map((option) => (
        <button key={option.value} type="button" className={styles.choice} aria-pressed={value === option.value} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  );
}

export function StudioEmbedCodeBuilder() {
  const { viewer } = useSession();
  const storeId = viewer?.hasStore ? viewer.storeId ?? "" : "";
  const [kind, setKind] = useState<EmbedSnippetKind>("button");
  const [theme, setTheme] = useState<EmbedSnippetTheme>("light");
  const [layout, setLayout] = useState<EmbedSnippetLayout>("grid");
  const [productLink, setProductLink] = useState("");
  const [copied, setCopied] = useState(false);
  const productId = readProductIdFromNanttyLink(productLink) ?? undefined;
  const options = { origin: embedOrigin, kind, storeId, productId, theme, layout };
  const missing = kind === "button" ? (productId === undefined ? "Paste a Nantty product link." : null) : storeId === "" ? "Open a store on Nantty to embed a store card or products." : null;
  const snippet = missing === null ? buildEmbedSnippet(options) : "";

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet).then(() => setCopied(true), () => setCopied(false));
  }

  return (
    <div className={styles.page}>
      <header>
        <h2 className={styles.title}>Embed on your site</h2>
        <p className={styles.subtitle}>Add a Buy on Nantty button for products you promote, or your store and products, to your own website or blog. Buying always opens Nantty.</p>
      </header>
      <div className={styles.layout}>
        <div className={styles.card}>
          <span className={styles.cardTitle}>What to show</span>
          <ChoiceGroup options={kinds.map((option) => ({ value: option.value, label: option.label, disabled: option.needsStore && storeId === "" }))} value={kind} onChange={(next) => { setKind(next); setCopied(false); }} />
          {kind === "button" ? (
            <label className={styles.field}>Product link
              <input className={styles.input} value={productLink} onChange={(event) => { setProductLink(event.target.value); setCopied(false); }} placeholder="https://nantty.com/p/adire-two-piece-…" />
            </label>
          ) : null}
          <span className={styles.cardTitle}>Theme</span>
          <ChoiceGroup options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const} value={theme} onChange={setTheme} />
          {kind === "products" ? (
            <>
              <span className={styles.cardTitle}>Layout</span>
              <ChoiceGroup options={[{ value: "grid", label: "Grid" }, { value: "carousel", label: "Carousel" }] as const} value={layout} onChange={setLayout} />
            </>
          ) : null}
          <span className={styles.cardTitle}><CodeIcon size={16} /> Embed code</span>
          {missing === null ? <pre className={styles.code}>{snippet}</pre> : <p className={styles.muted}>{missing}</p>}
          <button type="button" className={styles.copy} onClick={copySnippet} disabled={missing !== null}><CopyIcon size={16} />{copied ? "Copied" : "Copy code"}</button>
        </div>
        <div className={styles.card}>
          <span className={styles.cardTitle}>Live preview</span>
          {missing === null
            ? <iframe key={buildEmbedFrameUrl(options)} className={styles.preview} src={buildEmbedFrameUrl(options)} sandbox={embedPreviewSandbox} title="Embed preview" referrerPolicy="strict-origin-when-cross-origin" />
            : <p className={styles.muted}>{missing}</p>}
          <p className={styles.muted}>Suspended stores and hidden or sold-out products never show to buyers.</p>
        </div>
      </div>
    </div>
  );
}
