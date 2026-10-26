import { isEmailTemplateKey, listEmailTemplateCatalogue, renderEmail, renderEmailSample, type EmailBrandConfig, type EmailTemplateCatalogueEntry, type RenderedEmail } from "@nantty/email-templates";

import { notFoundError } from "../../../../errors/notifications.error.js";
import type { PolicyUpdatedPreviewBody } from "../../validators/emailTemplates.validator.js";

export interface RenderedEmailPreview {
  readonly key: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

type PreviewTheme = "light" | "dark";

export class PreviewEmailTemplateHandler {
  private readonly links: { readonly unsubscribeUrl: string; readonly preferencesUrl: string; readonly manageNotificationsUrl: string };

  public constructor(private readonly brand: EmailBrandConfig | undefined, webBaseUrl: string) {
    const base = webBaseUrl.replace(/\/+$/, "");
    this.links = { unsubscribeUrl: `${base}/email/unsubscribe?preview=1`, preferencesUrl: `${base}/settings/notifications/email`, manageNotificationsUrl: `${base}/settings/notifications` };
  }

  public listCatalogue(): { readonly items: readonly EmailTemplateCatalogueEntry[] } {
    return { items: listEmailTemplateCatalogue() };
  }

  public async previewSample(key: string, theme: PreviewTheme): Promise<RenderedEmailPreview> {
    if (!isEmailTemplateKey(key)) throw notFoundError("No email template uses that key.");
    return this.present(key, await renderEmailSample(key, this.options(theme)));
  }

  public async previewPolicyUpdated(body: PolicyUpdatedPreviewBody): Promise<RenderedEmailPreview> {
    const rendered = await renderEmail("policyUpdated", {
      firstName: "Amaka", policyName: body.documentTitle, subjectLine: body.subject, summary: body.summaryText, changes: body.whatChanged, effectiveAt: body.effectiveAt,
      requiresReacceptance: body.reacceptNote !== null, policyUrl: body.documentUrl, ...(body.reacceptNote === null ? {} : { reacceptNote: body.reacceptNote, acceptUrl: body.documentUrl }),
    }, this.options(body.theme));
    return this.present("policyUpdated", rendered);
  }

  private options(theme: PreviewTheme) {
    return { theme, links: this.links, ...(this.brand === undefined ? {} : { brand: this.brand }) };
  }

  private present(key: string, rendered: RenderedEmail): RenderedEmailPreview {
    return { key, subject: rendered.subject, html: rendered.html, text: rendered.text };
  }
}
