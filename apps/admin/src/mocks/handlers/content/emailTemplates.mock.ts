import { isEmailTemplateKey, listEmailTemplateCatalogue, renderEmail, renderEmailSample, type EmailTheme } from "@nantty/email-templates";

import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { failValidation, readJsonObjectBody, readOptionalTrimmedString, readRequiredTrimmedString, respondWithError, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";

const previewLinks = { unsubscribeUrl: "https://nantty.com/email/unsubscribe?preview=1", preferencesUrl: "https://nantty.com/settings/notifications/email", manageNotificationsUrl: "https://nantty.com/settings/notifications" };

function readTheme(value: unknown): EmailTheme {
  return value === "dark" ? "dark" : "light";
}

function readChangeLines(body: Record<string, unknown>): string[] {
  const value = body.whatChanged;
  if (!Array.isArray(value) || value.some((line) => typeof line !== "string")) failValidation("whatChanged", "whatChanged must be a list of lines.");
  return (value as string[]).map((line) => line.trim()).filter(Boolean).slice(0, 12).map((line) => line.slice(0, 300));
}

function readEffectiveAt(body: Record<string, unknown>): string {
  const value = readRequiredTrimmedString(body, "effectiveAt", 40);
  if (Number.isNaN(Date.parse(value))) failValidation("effectiveAt", "effectiveAt must be a date.");
  return value;
}

function readHttpsUrl(body: Record<string, unknown>, fieldName: string): string {
  const value = readRequiredTrimmedString(body, fieldName, 500);
  if (!/^https:\/\//.test(value)) failValidation(fieldName, `${fieldName} must be an https link.`);
  return value;
}

async function renderPolicyUpdatedPreview(request: MockRequest) {
  requireMockPermission(request, "support:email", "legal.documents.view", "legal.documents.edit", "legal.notices.send");
  const body = readJsonObjectBody(request);
  const reacceptNote = readOptionalTrimmedString(body, "reacceptNote", 600);
  const documentUrl = readHttpsUrl(body, "documentUrl");
  const rendered = await renderEmail(
    "policyUpdated",
    {
      firstName: "Amaka",
      policyName: readRequiredTrimmedString(body, "documentTitle", 120),
      subjectLine: readRequiredTrimmedString(body, "subject", 150),
      summary: readRequiredTrimmedString(body, "summaryText", 2000),
      changes: readChangeLines(body),
      effectiveAt: readEffectiveAt(body),
      requiresReacceptance: reacceptNote !== null,
      reacceptNote: reacceptNote ?? undefined,
      policyUrl: documentUrl,
      acceptUrl: reacceptNote !== null ? documentUrl : undefined,
    },
    { theme: readTheme(body.theme), links: previewLinks },
  );
  return respondWithJson(200, { key: "policyUpdated", ...rendered });
}

export function registerEmailTemplateMockHandlers(): void {
  registerMockRoute("GET", "/admin/email-templates", (request) => {
    requireMockPermission(request, "support:email");
    return respondWithJson(200, { items: listEmailTemplateCatalogue() });
  });

  registerMockRoute("POST", "/admin/email-templates/policy-updated/preview", renderPolicyUpdatedPreview);

  registerMockRoute("GET", "/admin/email-templates/:key/preview", async (request) => {
    requireMockPermission(request, "support:email");
    const key = request.params.key ?? "";
    if (!isEmailTemplateKey(key)) return respondWithError(404, "NOT_FOUND", "No email template uses that key.");
    const rendered = await renderEmailSample(key, { theme: readTheme(request.query.get("theme")), links: previewLinks });
    return respondWithJson(200, { key, ...rendered });
  });
}
