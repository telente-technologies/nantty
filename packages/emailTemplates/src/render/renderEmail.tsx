import { render } from "@react-email/render";

import { runWithEmailEnvironment } from "../blocks/emailRenderContext";
import { defaultEmailBrand } from "../config/emailBrand.config";
import type { EmailBrandConfig, EmailContext, EmailLinks, EmailTheme } from "../emailTypes";
import { formatDate, formatDateTime, formatMoney } from "../format/emailFormat";
import { readEmailTemplate, type EmailTemplateKey, type EmailTemplateProps } from "../templates/templateRegistry";
import { selectPalette } from "../theme/emailPalette";
import { renderPlainText } from "./plainText";

export interface RenderEmailOptions {
  readonly locale?: string;
  readonly theme?: EmailTheme;
  readonly timeZone?: string;
  readonly brand?: Partial<EmailBrandConfig>;
  readonly links?: Partial<EmailLinks>;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export function createEmailContext(options: RenderEmailOptions = {}): EmailContext {
  const locale = options.locale ?? "en-NG";
  const timeZone = options.timeZone ?? "Africa/Lagos";
  const brand: EmailBrandConfig = { ...defaultEmailBrand, ...options.brand };
  const url = (path: string) => (/^https?:\/\//.test(path) ? path : `${brand.webBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`);
  return {
    locale,
    theme: options.theme ?? "auto",
    brand,
    links: {
      manageNotificationsUrl: options.links?.manageNotificationsUrl ?? url("/settings/notifications"),
      preferencesUrl: options.links?.preferencesUrl ?? url("/settings/notifications/email"),
      unsubscribeUrl: options.links?.unsubscribeUrl ?? url("/email/unsubscribe"),
    },
    money: (amount) => formatMoney(amount, locale),
    date: (iso) => formatDate(iso, locale, timeZone),
    dateTime: (iso) => formatDateTime(iso, locale, timeZone),
    url,
  };
}

export async function renderEmail<K extends EmailTemplateKey>(templateKey: K, props: EmailTemplateProps<K>, options: RenderEmailOptions = {}): Promise<RenderedEmail> {
  const template = readEmailTemplate(templateKey);
  const context = createEmailContext(options);
  const { Component } = template;
  const html = await runWithEmailEnvironment({ palette: selectPalette(context.theme), context }, () => render(<Component data={props} context={context} />));
  const text = renderPlainText(template.blocks(props, context), context, template.kind, template.reason?.(props));
  return { subject: template.subject(props, context), html, text };
}
