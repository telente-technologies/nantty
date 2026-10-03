import type { SuppressionRepository } from "../../../../interfaces/repositories.interface.js";
import type { RecordSesFeedbackCommand, RecordSesFeedbackResult } from "./recordSesFeedback.command.js";

interface RecipientEntry {
  readonly emailAddress?: unknown;
}

interface SesFeedback {
  readonly eventType?: unknown;
  readonly notificationType?: unknown;
  readonly bounce?: { readonly bounceType?: unknown; readonly bouncedRecipients?: readonly RecipientEntry[] };
  readonly complaint?: { readonly complainedRecipients?: readonly RecipientEntry[] };
}

const readAddresses = (entries: readonly RecipientEntry[] | undefined): string[] =>
  (entries ?? []).flatMap((entry) => (typeof entry.emailAddress === "string" && entry.emailAddress.includes("@") ? [entry.emailAddress.toLowerCase()] : []));

export class RecordSesFeedbackHandler {
  public constructor(private readonly suppressions: SuppressionRepository) {}

  public async execute(command: RecordSesFeedbackCommand): Promise<RecordSesFeedbackResult> {
    const feedback = command.feedback as SesFeedback;
    const kind = feedback.eventType ?? feedback.notificationType;
    const suppressed: { email: string; reason: "hard_bounce" | "complaint" }[] = [];
    if (kind === "Bounce" && feedback.bounce?.bounceType === "Permanent") {
      for (const email of readAddresses(feedback.bounce.bouncedRecipients)) suppressed.push({ email, reason: "hard_bounce" });
    } else if (kind === "Complaint") {
      for (const email of readAddresses(feedback.complaint?.complainedRecipients)) suppressed.push({ email, reason: "complaint" });
    }
    for (const entry of suppressed) await this.suppressions.upsert(entry.email, entry.reason, "ses_feedback");
    return { suppressed };
  }
}
