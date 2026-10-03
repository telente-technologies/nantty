import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { EmailPreviewTheme, EmailTemplateSummary, PolicyUpdatedPreviewInput, RenderedEmailPreview } from "@/types/emailTemplates.type";

export function fetchEmailTemplateCatalogue(signal?: AbortSignal): Promise<{ items: EmailTemplateSummary[] }> {
  return sendAdminApiRequest("/admin/email-templates", { signal });
}

export function fetchEmailTemplatePreview(key: string, theme: EmailPreviewTheme, signal?: AbortSignal): Promise<RenderedEmailPreview> {
  return sendAdminApiRequest(`/admin/email-templates/${encodeURIComponent(key)}/preview`, { query: { theme }, signal });
}

export function previewPolicyUpdatedEmail(input: PolicyUpdatedPreviewInput, signal?: AbortSignal): Promise<RenderedEmailPreview> {
  return sendAdminApiRequest("/admin/email-templates/policy-updated/preview", { method: "POST", body: input, signal });
}
