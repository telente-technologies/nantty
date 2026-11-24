import { readEmailTemplate, renderEmail, type EmailBrandConfig, type EmailTemplateKey } from "@nantty/email-templates";

import { marketingFrequencyWindowMs } from "../../../constants/delivery.constant.js";
import { defaultEmailEnabledByCategory } from "../../../constants/notificationCategories.constant.js";
import type { EmailSender, OutgoingEmail } from "../../../interfaces/emailSender.interface.js";
import type { DeliveryRepository, PreferenceRepository, SuppressionRepository } from "../../../interfaces/repositories.interface.js";
import type { MailKind, PreferenceCategory, Recipient } from "../../../types/notification.type.js";
import type { UnsubscribeTokenService } from "../../unsubscribe/services/unsubscribeToken.service.js";
import { decideEmailEligibility } from "./emailEligibility.service.js";

interface BaseRequest {
  readonly dedupeKey: string;
  readonly eventId: string;
  readonly recipient: Recipient;
  readonly addressVerifiedByFlow?: boolean;
  readonly preferenceCategory: PreferenceCategory;
}

export interface TemplateEmailRequest extends BaseRequest {
  readonly templateKey: EmailTemplateKey;
  readonly props: unknown;
}

export interface CustomEmailResult {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly sender?: { readonly from: string; readonly replyTo: string };
}

export interface CustomEmailRequest extends BaseRequest {
  readonly mailKind: MailKind;
  readonly render: (unsubscribeUrl: string) => CustomEmailResult | Promise<CustomEmailResult>;
}

export type EmailDeliveryOutcome = { readonly status: "sent" | "skipped" | "failed" | "duplicate"; readonly reason?: string; readonly previous?: string };

export class EmailDeliveryFailure extends Error {
  public constructor(public readonly attemptCount: number, message: string) {
    super(message);
    this.name = "EmailDeliveryFailure";
  }
}

export class EmailDeliveryService {
  public constructor(
    private readonly deps: {
      readonly sender: EmailSender;
      readonly deliveries: DeliveryRepository;
      readonly suppressions: SuppressionRepository;
      readonly preferences: PreferenceRepository;
      readonly unsubscribeTokens: UnsubscribeTokenService;
      readonly marketingMaxPerWeek: number;
      readonly brand?: EmailBrandConfig;
      readonly now?: () => Date;
    },
  ) {}

  public deliver(request: TemplateEmailRequest): Promise<EmailDeliveryOutcome> {
    const mailKind: MailKind = readEmailTemplate(request.templateKey).kind;
    return this.run(request, mailKind, request.templateKey, async (unsubscribeUrl) => renderEmail(request.templateKey, request.props as never, { links: { unsubscribeUrl }, ...(this.deps.brand === undefined ? {} : { brand: this.deps.brand }) }));
  }

  public get brand(): EmailBrandConfig | undefined {
    return this.deps.brand;
  }

  public deliverCustom(request: CustomEmailRequest): Promise<EmailDeliveryOutcome> {
    return this.run(request, request.mailKind, null, async (unsubscribeUrl) => request.render(unsubscribeUrl));
  }

  private async run(request: BaseRequest, mailKind: MailKind, templateKey: string | null, render: (unsubscribeUrl: string) => Promise<{ subject: string; html: string; text: string; sender?: { from: string; replyTo: string } }>): Promise<EmailDeliveryOutcome> {
    const { deliveries } = this.deps;
    const claim = await deliveries.claim({ dedupeKey: request.dedupeKey, eventId: request.eventId, userId: request.recipient.accountId, channel: "email", templateKey, mailKind });
    if (claim.alreadyProcessed) return { status: "duplicate", previous: claim.status };

    const eligibility = await this.checkEligibility(request, mailKind);
    if (!eligibility.allowed) {
      await deliveries.finish(claim.id, "skipped", { skipReason: eligibility.reason });
      return { status: "skipped", reason: eligibility.reason };
    }
    try {
      const unsubscribeUrl = this.deps.unsubscribeTokens.buildUnsubscribeUrl(request.recipient.accountId);
      const { sender, ...rendered } = await render(unsubscribeUrl);
      const message: OutgoingEmail = {
        to: request.recipient.email ?? "",
        ...rendered,
        ...(sender === undefined ? {} : { from: sender.from, replyTo: sender.replyTo }),
        ...(mailKind === "marketing" ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
        tags: { kind: mailKind, ...(templateKey === null ? {} : { template: templateKey }) },
      };
      const { messageId } = await this.deps.sender.send(message);
      await deliveries.finish(claim.id, "sent", { providerMessageId: messageId });
      return { status: "sent" };
    } catch {
      await deliveries.finish(claim.id, "failed", { skipReason: "email_provider_send_failed" });
      throw new EmailDeliveryFailure(claim.attemptCount, "email_provider_send_failed");
    }
  }

  private async checkEligibility(request: BaseRequest, mailKind: MailKind) {
    const { recipient } = request;
    const now = (this.deps.now ?? (() => new Date()))();
    const address = recipient.email ?? "";
    const preference = (await this.deps.preferences.list(recipient.accountId)).find((row) => row.category === request.preferenceCategory);
    return decideEmailEligibility({
      mailKind,
      recipient,
      addressVerifiedByFlow: request.addressVerifiedByFlow ?? false,
      suppression: address === "" ? null : await this.deps.suppressions.find(address),
      preferenceEmailEnabled: preference?.email ?? defaultEmailEnabledByCategory[request.preferenceCategory],
      marketingEmailsSentInWindow: mailKind === "marketing" ? await this.deps.deliveries.countSentEmails(recipient.accountId, "marketing", new Date(now.getTime() - marketingFrequencyWindowMs)) : 0,
      marketingMaxPerWindow: this.deps.marketingMaxPerWeek,
    });
  }
}
