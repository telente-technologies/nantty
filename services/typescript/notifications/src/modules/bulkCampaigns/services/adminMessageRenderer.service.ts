import { renderEmail, type EmailBrandConfig } from "@nantty/email-templates";

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

export async function renderAdminMessage(input: AdminMessageInput): Promise<RenderedAdminMessage> {
  const fill = (template: string) => template.replace(/\{\{firstName\}\}/g, input.firstName).replace(/\{\{unsubscribeUrl\}\}/g, input.unsubscribeUrl);
  const subjectLine = fill(input.subject);
  const rawParagraphs = fill(input.body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const paragraphs = rawParagraphs.length > 0 ? rawParagraphs : [subjectLine];

  const rendered = await renderEmail(
    input.marketing ? "adminNoticeMarketing" : "adminNoticeTransactional",
    { subjectLine, paragraphs },
    {
      links: { unsubscribeUrl: input.unsubscribeUrl },
      ...(input.brand === undefined ? {} : { brand: input.brand }),
    },
  );

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    includesUnsubscribeLink: input.marketing,
  };
}
