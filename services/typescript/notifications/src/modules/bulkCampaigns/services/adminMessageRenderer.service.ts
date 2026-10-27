import { defaultEmailBrand, type EmailBrandConfig } from "@nantty/email-templates";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface AdminMessageInput {
  readonly subject: string;
  readonly body: string;
  readonly firstName: string;
  readonly marketing: boolean;
  readonly unsubscribeUrl: string;
  readonly brand?: EmailBrandConfig;
}

export interface RenderedAdminMessage {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly includesUnsubscribeLink: boolean;
}

const unsubscribeFooterText = "You are getting this because you agreed to Nantty updates. Unsubscribe: {{unsubscribeUrl}}";

export function renderAdminMessage(input: AdminMessageInput): RenderedAdminMessage {
  const brand = input.brand ?? defaultEmailBrand;
  const withFooter = input.marketing && !input.body.includes("{{unsubscribeUrl}}") ? `${input.body}\n\n--\n${unsubscribeFooterText}` : input.body;
  const fill = (template: string) => template.replace(/\{\{firstName\}\}/g, input.firstName).replace(/\{\{unsubscribeUrl\}\}/g, input.unsubscribeUrl);
  const text = fill(withFooter);
  const subject = fill(input.subject);
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff"><div style="max-width:560px;margin:0 auto">${paragraphs}<p style="margin:24px 0 0;font-size:12px;color:#666">${escapeHtml(brand.productName)} · ${escapeHtml(brand.companyAddress)}</p></div></body></html>`;
  return { subject, html, text, includesUnsubscribeLink: input.marketing };
}
