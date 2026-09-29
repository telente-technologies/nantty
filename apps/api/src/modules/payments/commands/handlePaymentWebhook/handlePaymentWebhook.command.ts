import { Command } from "@zudojs/cqrs";

export class HandlePaymentWebhookCommand extends Command<"payments.handlePaymentWebhook"> {
  public constructor(
    public readonly provider: string,
    public readonly rawBody: Uint8Array,
  ) {
    super("payments.handlePaymentWebhook");
  }
}
