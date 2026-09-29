import type { WebhookNotice } from "../gateways/paymentGateway.interface.js";

export interface PaymentWebhookDelivery {
  readonly provider: string;
  readonly notice: WebhookNotice;
  readonly rawBody: Uint8Array;
}

export type PaymentWebhookHandler = (delivery: PaymentWebhookDelivery) => Promise<void>;

interface PaymentWebhookRoute {
  readonly name: string;
  readonly matches: (notice: WebhookNotice) => boolean;
  readonly handle: PaymentWebhookHandler;
}

export class PaymentWebhookRegistry {
  private readonly routes: PaymentWebhookRoute[] = [];

  public registerReferencePrefix(name: string, referencePrefix: string, handle: PaymentWebhookHandler): void {
    this.assertNameIsFree(name);
    this.routes.push({ name, handle, matches: (notice) => notice.reference?.startsWith(referencePrefix) === true });
  }

  public registerEventType(name: string, eventType: string, handle: PaymentWebhookHandler): void {
    this.assertNameIsFree(name);
    this.routes.push({ name, handle, matches: (notice) => notice.eventType === eventType });
  }

  public findHandlerForNotice(notice: WebhookNotice): PaymentWebhookHandler | undefined {
    return this.routes.find((route) => route.matches(notice))?.handle;
  }

  private assertNameIsFree(name: string): void {
    if (this.routes.some((route) => route.name === name)) throw new Error(`A payment webhook handler named "${name}" is already registered.`);
  }
}
