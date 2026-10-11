import type { Money } from "@/types";

import { renderEmbedIcon } from "./embedIcons.util";
import type { EmbedLayout, EmbedTheme } from "./embedOptions.util";
import { formatMoneyForDisplay } from "./formatMoney.util";

export interface EmbedStoreCard {
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly bio: string;
  readonly verified: boolean;
  readonly productsCount: number;
  readonly url: string;
}

export interface EmbedProductCard {
  readonly name: string;
  readonly price: Money;
  readonly imageUrl: string | null;
  readonly inStock: boolean;
  readonly url: string;
}

export const embedResizeScript =
  '(function(){var m=location.hash.match(/frame=([A-Za-z0-9_-]{8,64})/);if(!m||window.parent===window)return;var f=m[1];function s(){window.parent.postMessage({type:"zudomart:embed:resize",frame:f,height:Math.ceil(document.documentElement.scrollHeight)},"*")}s();if(window.ResizeObserver){new ResizeObserver(s).observe(document.body)}window.addEventListener("load",s)})();';

const themeVariables: Readonly<Record<EmbedTheme, string>> = {
  light: "--bg:#ffffff;--surface:#f0f2fa;--text:#0a0a14;--muted:#5b5b6b;--border:#e4e6f2;--brand:#3a2bff;--on-brand:#ffffff;--brand-hover:#3024d2;--danger:#b91c1c",
  dark: "--bg:#0b0d17;--surface:#141726;--text:#f2f3f8;--muted:#a9adc2;--border:#2a3048;--brand:#4e40ff;--on-brand:#ffffff;--brand-hover:#6155ff;--danger:#fca5a5",
};

const embedStyles = `*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit;text-decoration:none}.zd{padding:12px}.card{display:flex;gap:12px;align-items:center;border:1px solid var(--border);border-radius:14px;padding:12px;background:var(--bg)}
.logo{width:56px;height:56px;border-radius:50%;object-fit:cover;background:var(--surface);flex:none}.grow{flex:1;min-width:0}.name{font-weight:700;font-size:15px;display:flex;gap:4px;align-items:center}
.muted{color:var(--muted);font-size:12px}.clip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.badge{color:var(--brand)}
.btn{display:inline-flex;gap:6px;align-items:center;justify-content:center;background:var(--brand);color:var(--on-brand);border-radius:999px;padding:8px 14px;font-weight:600;font-size:13px;white-space:nowrap}
.btn:hover{background:var(--brand-hover)}.btn[aria-disabled=true]{opacity:.55}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.carousel{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(150px,46%);gap:10px;overflow-x:auto;scroll-snap-type:x mandatory}.carousel>*{scroll-snap-align:start}
.tile{border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:var(--bg)}.thumb{width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--surface);display:block}
.tile .body{padding:8px 10px 10px;display:flex;flex-direction:column;gap:6px}.price{font-weight:700}.foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.brandmark{display:inline-flex;gap:4px;align-items:center;color:var(--muted);font-size:11px}.unavailable{border:1px dashed var(--border);border-radius:14px;padding:16px;text-align:center;color:var(--muted)}`;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`]/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function safeImageUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function image(url: string | null, className: string, alt: string): string {
  const safe = safeImageUrl(url);
  return safe === null ? `<span class="${className}" aria-hidden="true"></span>` : `<img class="${className}" src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

function outboundLink(url: string, className: string, content: string, label?: string): string {
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${label === undefined ? "" : ` aria-label="${escapeHtml(label)}"`}>${content}</a>`;
}

const poweredBy = `<span class="brandmark">${renderEmbedIcon("storefrontBold", 12, "")}Zudomart</span>`;

export function renderEmbedDocument(title: string, theme: EmbedTheme, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>:root{${themeVariables[theme]};color-scheme:${theme}}${embedStyles}</style></head><body><main class="zd">${body}</main><script>${embedResizeScript}</script></body></html>`;
}

export function renderStoreCardMarkup(store: EmbedStoreCard): string {
  const verified = store.verified ? `<span class="badge" title="Verified">${renderEmbedIcon("sealCheckFill", 16, "")}</span>` : "";
  return `<div class="card">${image(store.logoUrl, "logo", store.name)}<div class="grow"><div class="name"><span class="clip">${escapeHtml(store.name)}</span>${verified}</div>`
    + `<div class="muted clip">@${escapeHtml(store.handle)} · ${store.productsCount} products</div>${store.bio === "" ? "" : `<div class="muted clip">${escapeHtml(store.bio)}</div>`}</div>`
    + `${outboundLink(store.url, "btn", `${renderEmbedIcon("storefrontBold", 14, "")}Visit store`)}</div>`;
}

function productTile(product: EmbedProductCard): string {
  const buy = product.inStock ? outboundLink(product.url, "btn", `${renderEmbedIcon("shoppingBagBold", 14, "")}Buy`, `Buy ${product.name} on Zudomart`) : `<span class="btn" aria-disabled="true">Sold out</span>`;
  return `<div class="tile">${outboundLink(product.url, "", image(product.imageUrl, "thumb", product.name), product.name)}<div class="body"><div class="clip">${escapeHtml(product.name)}</div>`
    + `<div class="price">${escapeHtml(formatMoneyForDisplay(product.price, { showDecimals: false }))}</div>${buy}</div></div>`;
}

export function renderProductCollectionMarkup(products: readonly EmbedProductCard[], layout: EmbedLayout, storeName: string, storeUrl: string): string {
  if (products.length === 0) return renderUnavailableMarkup("No products to show right now.");
  return `<div class="${layout}">${products.map(productTile).join("")}</div><div class="foot">${outboundLink(storeUrl, "muted", `More from ${escapeHtml(storeName)}`)}${poweredBy}</div>`;
}

export function renderBuyButtonMarkup(product: EmbedProductCard, view: "button" | "card"): string {
  if (view === "card") return `<div style="max-width:320px">${productTile(product)}</div>`;
  if (!product.inStock) return `<span class="btn" aria-disabled="true">Sold out on Zudomart</span>`;
  return outboundLink(product.url, "btn", `${renderEmbedIcon("shoppingBagBold", 16, "")}Buy on Zudomart`, `Buy ${product.name} on Zudomart`);
}

export function renderUnavailableMarkup(message: string): string {
  return `<div class="unavailable">${escapeHtml(message)}</div>`;
}
