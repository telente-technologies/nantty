export type EmailTemplateKind = "transactional" | "security" | "legal" | "marketing";
export type EmailPreviewTheme = "light" | "dark";

export interface EmailTemplateSummary {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly kind: EmailTemplateKind;
  readonly audience: string;
  readonly trigger: string;
  readonly consent: string;
}

export interface RenderedEmailPreview {
  readonly key: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface PolicyUpdatedPreviewInput {
  readonly theme: EmailPreviewTheme;
  readonly documentTitle: string;
  readonly subject: string;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly effectiveAt: string;
  readonly reacceptNote: string | null;
  readonly documentUrl: string;
}
