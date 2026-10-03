import type { EmailCategory, EmailKind } from "./emailTypes";
import { renderEmail, type RenderEmailOptions, type RenderedEmail } from "./render/renderEmail";
import { emailTemplateKeys, readEmailTemplate, type EmailTemplateKey } from "./templates/templateRegistry";

export interface EmailTemplateCatalogueEntry {
  readonly key: EmailTemplateKey;
  readonly name: string;
  readonly category: EmailCategory;
  readonly kind: EmailKind;
  readonly audience: string;
  readonly trigger: string;
  readonly consent: string;
}

export function listEmailTemplateCatalogue(): EmailTemplateCatalogueEntry[] {
  return emailTemplateKeys.map((key) => {
    const { name, category, kind, audience, trigger, consent } = readEmailTemplate(key);
    return { key, name, category, kind, audience, trigger, consent };
  });
}

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return (emailTemplateKeys as readonly string[]).includes(value);
}

export function renderEmailSample(key: EmailTemplateKey, options: RenderEmailOptions = {}): Promise<RenderedEmail> {
  return renderEmail(key, readEmailTemplate(key).sample, options);
}
