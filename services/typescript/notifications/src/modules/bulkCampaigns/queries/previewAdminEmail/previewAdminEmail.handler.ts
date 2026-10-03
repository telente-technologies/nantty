import type { AudiencePlannerService } from "../../services/audiencePlanner.service.js";
import { renderAdminMessage } from "../../services/adminMessageRenderer.service.js";
import type { PreviewAdminEmailQuery } from "./previewAdminEmail.query.js";

export class PreviewAdminEmailHandler {
  public constructor(private readonly planner: AudiencePlannerService) {}

  public async execute(query: PreviewAdminEmailQuery) {
    const marketing = query.kind === "MARKETING";
    const plan = await this.planner.plan(query.audience, marketing ? "marketing" : "transactional");
    const rendered = renderAdminMessage({ subject: query.subject, body: query.body, firstName: "{{firstName}}", marketing, unsubscribeUrl: "{{unsubscribeUrl}}" });
    return {
      recipientCount: plan.eligibleCount,
      skippedNoMarketingConsent: plan.skippedNoMarketingConsent,
      includesUnsubscribeLink: rendered.includesUnsubscribeLink,
      renderedSubject: rendered.subject,
      renderedBody: rendered.text,
      provider: "AWS_SES" as const,
    };
  }
}
