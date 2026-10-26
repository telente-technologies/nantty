import { richToText } from "../blocks/richText.block";
import type { EmailBlock, EmailContext, EmailKind } from "../emailTypes";
import { addMoney, multiplyMoney } from "../format/emailFormat";
import { defaultReasons } from "../layout/emailFooter.layout";

function blockToText(block: EmailBlock, context: EmailContext): string {
  switch (block.type) {
    case "hero":
      return `${block.eyebrow.toUpperCase()}\n${block.title}\n${"=".repeat(Math.min(block.title.length, 60))}`;
    case "paragraph":
      return richToText(block.text);
    case "button":
      return `${block.label}: ${block.href}`;
    case "links":
      return block.items.map((item) => `${item.label}: ${item.href}`).join("\n");
    case "callout":
      return `[${block.title ?? "Note"}] ${richToText(block.text)}`;
    case "details":
      return [block.title?.toUpperCase(), ...block.rows.map((row) => `${row.label}: ${row.value}`)].filter(Boolean).join("\n");
    case "code":
      return `${block.code}\n${block.caption}`;
    case "orderGroups":
      return block.groups
        .map((group) => {
          const lines = group.items.map((item) => `  ${item.quantity} × ${item.name}${item.variant ? ` (${item.variant})` : ""} — ${context.money(multiplyMoney(item.unitPrice, item.quantity))}`);
          const subtotal = addMoney(...group.items.map((item) => multiplyMoney(item.unitPrice, item.quantity)), group.shipping);
          return [`Sold by ${group.sellerName}${group.status ? ` — ${group.status}` : ""}`, ...lines, `  Shipping${group.shippingMethod ? ` (${group.shippingMethod})` : ""}: ${group.shipping.amountMinor === 0 ? "Free" : context.money(group.shipping)}`, `  From this seller: ${context.money(subtotal)}`].join("\n");
        })
        .join("\n\n");
    case "totals":
      return [...block.rows.map((row) => `${row.label}: ${row.credit ? "-" : ""}${context.money(row.amount)}`), `${block.total.label}: ${context.money(block.total.amount)}`].join("\n");
    case "track":
      return [block.steps.map((step, index) => (index < block.current ? `[x] ${step}` : index === block.current ? `[>] ${step}` : `[ ] ${step}`)).join("  "), block.caption].filter(Boolean).join("\n");
    case "steps":
      return block.items.map((item) => `${item.state === "done" ? "[x]" : item.state === "current" ? "[>]" : "[ ]"} ${item.title} — ${item.text}`).join("\n");
    case "progress":
      return block.items.map((item) => `${item.label}: ${item.display ?? `${item.value} / ${item.target}`}`).join("\n");
    case "products":
      return [block.title, ...block.items.map((item) => `- ${item.name} by ${item.sellerName} — ${context.money(item.price)}${item.compareAtPrice ? ` (was ${context.money(item.compareAtPrice)})` : ""}\n  ${item.href}`)].filter(Boolean).join("\n");
    case "list":
      return [block.title, ...block.items.map((item) => `- ${richToText(item)}`)].filter(Boolean).join("\n");
    case "quote":
      return `${block.author}${block.meta ? ` · ${block.meta}` : ""}:\n"${block.text}"`;
    case "people":
      return [...block.items.map((person) => `- ${person.name} (@${person.handle})${person.note ? ` — ${person.note}` : ""}`), block.more].filter(Boolean).join("\n");
    case "rating":
      return [block.question, ...block.options.map((option) => `  ${option.label}: ${option.href}`)].join("\n");
    case "divider":
      return "—".repeat(24);
  }
}

export function renderPlainText(blocks: readonly EmailBlock[], context: EmailContext, kind: EmailKind, reason?: string): string {
  const { brand, links } = context;
  const body = blocks.map((block) => blockToText(block, context)).join("\n\n");
  const manage = kind === "marketing" ? `Unsubscribe: ${links.unsubscribeUrl}\nEmail preferences: ${links.preferencesUrl}` : `Manage notifications: ${links.manageNotificationsUrl}`;
  const footer = [
    "--",
    reason ?? defaultReasons[kind],
    manage,
    `Help Centre: ${brand.helpCenterUrl}`,
    `Support: ${brand.supportEmails.join(" or ")}`,
    "Nantty will never ask for your password, PIN or one-time code by email.",
    `App Store: ${brand.appStoreUrl}`,
    `Google Play: ${brand.playStoreUrl}`,
    `© ${new Date().getFullYear()} ${brand.companyLegalName}. ${brand.companyAddress}.`,
  ].join("\n");
  return `${brand.productName}\n\n${body}\n\n${footer}\n`;
}
