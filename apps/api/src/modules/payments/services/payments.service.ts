import { randomUUID } from "node:crypto";

import type { EventBus } from "@zudojs/events";

import { providerSupportsCurrency } from "../../../configs/currency.config.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { Money } from "../../../utils/money.util.js";
import type { EscrowRecord } from "../../escrows/models/escrows.model.js";
import type { EscrowPaymentRefunder, EscrowsService } from "../../escrows/services/escrows.service.js";
import type { OrdersRepository } from "../../orders/repositories/orders.repository.js";
import type { OrdersService } from "../../orders/services/orders.service.js";
import { PaymentFailedEvent, PaymentSucceededEvent } from "../events/paymentSucceeded.event.js";
import type { PaymentGateway } from "../gateways/paymentGateway.interface.js";
import type { PaymentRecord } from "../models/payments.model.js";
import type { PaymentsRepository, WebhookEventsRepository } from "../repositories/payments.repository.js";
import type { PaymentReturnUrls } from "./paymentReturnUrl.service.js";
import type { PaymentWebhookRegistry } from "./paymentWebhookRegistry.service.js";

export interface PaymentsDependencies {
  readonly payments: PaymentsRepository;
  readonly webhookEvents: WebhookEventsRepository;
  readonly orders: OrdersRepository;
  readonly ordersService: OrdersService;
  readonly escrowsService: () => EscrowsService;
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly userDirectory: UserDirectory;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly returnUrls: PaymentReturnUrls;
  readonly webhookRegistry: PaymentWebhookRegistry;
}

export interface InitializedCheckoutPayment {
  readonly payment: PaymentRecord;
  readonly authorizationUrl: string;
  readonly callbackUrl: string;
}

export interface WebhookOutcome {
  readonly duplicate: boolean;
}

export interface InitializedOrderPayment {
  readonly orderId: string;
  readonly reference: string;
  readonly authorizationUrl: string;
  readonly callbackUrl: string;
  readonly payment: PaymentRecord;
}

export type OrderPaymentStatus = "pending" | "paid" | "failed";

export class PaymentsService implements EscrowPaymentRefunder {
  public constructor(public readonly dependencies: PaymentsDependencies) {}

  public async initializeCheckoutPayment(buyerId: string, checkoutId: string, provider: PaymentProvider, returnTo?: string): Promise<InitializedCheckoutPayment> {
    const { orders, payments, userDirectory, returnUrls } = this.dependencies;
    const checkout = await orders.findCheckoutById(checkoutId);
    if (checkout === undefined || checkout.buyerId !== buyerId) throw notFound("Checkout");
    if (checkout.status !== "pending") throw invalidState("This checkout is no longer awaiting payment.");
    const previous = await payments.listForCheckout(checkoutId);
    if (previous.some((payment) => payment.status === "succeeded")) throw invalidState("This checkout has already been paid.");
    const gateway = this.findGatewayOrThrow(provider);
    if (!providerSupportsCurrency(provider, checkout.currency)) throw unprocessable(`${provider} cannot charge in ${checkout.currency}. Choose another payment provider.`);
    const reference = `zm_${randomUUID().replaceAll("-", "")}`;
    const callbackUrl = returnUrls.buildReturnUrlForReference(reference, returnTo);
    const payment = await payments.create({ checkoutId, buyerId, provider, reference, amount: checkout.total, currency: checkout.currency });
    const contact = await userDirectory.findUserContact(buyerId);
    const initialized = await gateway.initializePayment({
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      email: contact?.email ?? `buyer-${buyerId}@customers.zudomart.app`,
      callbackUrl,
      metadata: { checkoutId, paymentId: payment.id },
    });
    await payments.saveAuthorizationUrl(payment.id, initialized.authorizationUrl);
    return { payment: { ...payment, authorizationUrl: initialized.authorizationUrl }, authorizationUrl: initialized.authorizationUrl, callbackUrl };
  }

  public async initializeOrderPayment(buyerId: string, orderId: string, provider: PaymentProvider, returnTo?: string): Promise<InitializedOrderPayment> {
    const order = await this.dependencies.orders.findById(orderId);
    if (order === undefined || order.buyerId !== buyerId) throw notFound("Order");
    const initialized = await this.initializeCheckoutPayment(buyerId, order.checkoutId, provider, returnTo);
    return { orderId, reference: initialized.payment.reference, authorizationUrl: initialized.authorizationUrl, callbackUrl: initialized.callbackUrl, payment: initialized.payment };
  }

  public async verifyOrderPaymentForBuyer(buyerId: string, orderId: string): Promise<OrderPaymentStatus> {
    const order = await this.dependencies.orders.findById(orderId);
    if (order === undefined || order.buyerId !== buyerId) throw notFound("Order");
    const attempts = [...(await this.dependencies.payments.listForCheckout(order.checkoutId))].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
    const confirmed = await Promise.all(attempts.map((payment) => this.confirmPaymentWithProvider(payment)));
    if (confirmed.some((payment) => payment.status === "succeeded" || payment.status === "refunded")) return "paid";
    return confirmed[0]?.status === "failed" ? "failed" : "pending";
  }

  public async verifyPaymentForBuyer(buyerId: string, reference: string): Promise<PaymentRecord> {
    const payment = await this.dependencies.payments.findByReference(reference);
    if (payment === undefined || payment.buyerId !== buyerId) throw notFound("Payment");
    return this.confirmPaymentWithProvider(payment);
  }

  public async handleVerifiedWebhook(provider: string, rawBody: Uint8Array): Promise<WebhookOutcome> {
    const { webhookEvents, payments, clock, webhookRegistry } = this.dependencies;
    const gateway = this.findGatewayOrThrow(provider);
    const notice = gateway.readWebhookNotice(rawBody);
    if (!(await webhookEvents.claimEvent(provider, notice.eventKey))) return { duplicate: true };
    try {
      const claimedByModule = webhookRegistry.findHandlerForNotice(notice);
      if (claimedByModule !== undefined) {
        await claimedByModule({ provider, notice, rawBody });
      } else {
        const payment = notice.reference === null ? undefined : await payments.findByReference(notice.reference);
        if (payment !== undefined && payment.provider === provider) await this.confirmPaymentWithProvider(payment);
      }
      await webhookEvents.markEventProcessed(provider, notice.eventKey, clock.now());
      return { duplicate: false };
    } catch (error) {
      await webhookEvents.releaseEvent(provider, notice.eventKey);
      throw error;
    }
  }

  public async confirmPaymentWithProvider(payment: PaymentRecord): Promise<PaymentRecord> {
    const { payments, orders, ordersService, audit, events, clock } = this.dependencies;
    if (payment.status !== "pending") return payment;
    const verified = await this.findGatewayOrThrow(payment.provider).verifyPayment(payment.reference);
    if (verified.status === "pending") return payment;
    if (verified.status === "failed") {
      await payments.changeStatus(payment.id, "pending", "failed", { providerTransactionId: verified.providerTransactionId });
      await publishEvent(events, PaymentFailedEvent, { paymentId: payment.id, checkoutId: payment.checkoutId, buyerId: payment.buyerId, amount: payment.amount });
      return (await payments.findById(payment.id)) ?? payment;
    }
    if (verified.amount !== payment.amount || verified.currency.toUpperCase() !== payment.currency) {
      await audit.record({ actorId: null, action: "payments.amount_mismatch", entityType: "payment", entityId: payment.id, metadata: { expected: payment.amount, received: verified.amount, currency: verified.currency } });
      throw unprocessable("The amount paid does not match this checkout.");
    }
    const payableOrders = (await orders.listByCheckout(payment.checkoutId)).filter((order) => order.status === "pending_payment" || order.status === "paid");
    await this.dependencies.escrowsService().holdEscrowsForPaidOrders(payment.id, payment.provider, payableOrders);
    const marked = await payments.changeStatus(payment.id, "pending", "succeeded", { providerTransactionId: verified.providerTransactionId, paidAt: clock.now() });
    if (marked) {
      await ordersService.markCheckoutOrdersPaid(payment.checkoutId);
      await audit.record({ actorId: null, action: "payments.succeeded", entityType: "payment", entityId: payment.id, metadata: { amount: payment.amount, provider: payment.provider } });
      await publishEvent(events, NotificationRequestedEvent, { userId: payment.buyerId, category: "payments", title: "Payment received", body: "Your payment was confirmed. The seller will ship soon.", data: { checkoutId: payment.checkoutId } });
      await publishEvent(events, PaymentSucceededEvent, { paymentId: payment.id, checkoutId: payment.checkoutId, buyerId: payment.buyerId, amount: payment.amount });
    }
    return (await payments.findById(payment.id)) ?? payment;
  }

  public async refundEscrowPayment(escrow: EscrowRecord, chargedAmount: Money): Promise<{ readonly provider: string }> {
    const { payments } = this.dependencies;
    const payment = await payments.findById(escrow.paymentId);
    if (payment === undefined) throw notFound("Payment");
    if (payment.currency !== chargedAmount.currency) throw invalidState("The refund currency does not match the payment.");
    if (payment.refundedAmount + chargedAmount.amountMinor > payment.amount) throw invalidState("This payment has already been refunded.");
    await this.findGatewayOrThrow(payment.provider).refundPayment({
      reference: payment.reference, providerTransactionId: payment.providerTransactionId, amount: chargedAmount.amountMinor, currency: chargedAmount.currency,
    });
    await payments.addRefundedAmount(payment.id, chargedAmount.amountMinor);
    return { provider: payment.provider };
  }

  public async findPaymentForBuyer(buyerId: string, paymentId: string): Promise<PaymentRecord> {
    const payment = await this.dependencies.payments.findById(paymentId);
    if (payment === undefined || payment.buyerId !== buyerId) throw notFound("Payment");
    return payment;
  }

  public async listCheckoutPaymentsForBuyer(buyerId: string, checkoutId: string): Promise<readonly PaymentRecord[]> {
    const checkout = await this.dependencies.orders.findCheckoutById(checkoutId);
    if (checkout === undefined || checkout.buyerId !== buyerId) throw notFound("Checkout");
    return this.dependencies.payments.listForCheckout(checkoutId);
  }

  public findGatewayOrThrow(provider: string): PaymentGateway {
    const gateway = Object.hasOwn(this.dependencies.gateways, provider) ? this.dependencies.gateways[provider] : undefined;
    if (gateway === undefined) throw unprocessable("This payment provider is not supported.");
    return gateway;
  }
}
