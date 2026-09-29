import { randomUUID } from "node:crypto";

import type { PaymentStatus } from "../../../enums/paymentStatus.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { NewPayment, PaymentRecord } from "../models/payments.model.js";

export interface PaymentsRepository {
  create(input: NewPayment): Promise<PaymentRecord>;
  saveAuthorizationUrl(paymentId: string, authorizationUrl: string): Promise<void>;
  findById(paymentId: string): Promise<PaymentRecord | undefined>;
  findByReference(reference: string): Promise<PaymentRecord | undefined>;
  listForCheckout(checkoutId: string): Promise<readonly PaymentRecord[]>;
  changeStatus(paymentId: string, from: PaymentStatus, to: PaymentStatus, change: { providerTransactionId?: string | null; paidAt?: Date }): Promise<boolean>;
  addRefundedAmount(paymentId: string, amount: MinorUnits): Promise<boolean>;
}

export interface WebhookEventsRepository {
  claimEvent(provider: string, eventKey: string): Promise<boolean>;
  markEventProcessed(provider: string, eventKey: string, processedAt: Date): Promise<void>;
  releaseEvent(provider: string, eventKey: string): Promise<void>;
}

export class InMemoryPaymentsRepository implements PaymentsRepository {
  private readonly payments = new Map<string, PaymentRecord>();

  public async create(input: NewPayment): Promise<PaymentRecord> {
    const payment: PaymentRecord = { ...input, id: randomUUID(), status: "pending", authorizationUrl: null, providerTransactionId: null, paidAt: null, refundedAmount: 0, createdAt: new Date() };
    this.payments.set(payment.id, payment);
    return payment;
  }

  public async saveAuthorizationUrl(paymentId: string, authorizationUrl: string): Promise<void> {
    const payment = this.payments.get(paymentId);
    if (payment !== undefined) this.payments.set(paymentId, { ...payment, authorizationUrl });
  }

  public async findById(paymentId: string): Promise<PaymentRecord | undefined> {
    return this.payments.get(paymentId);
  }

  public async findByReference(reference: string): Promise<PaymentRecord | undefined> {
    return [...this.payments.values()].find((payment) => payment.reference === reference);
  }

  public async listForCheckout(checkoutId: string): Promise<readonly PaymentRecord[]> {
    return [...this.payments.values()].filter((payment) => payment.checkoutId === checkoutId);
  }

  public async changeStatus(paymentId: string, from: PaymentStatus, to: PaymentStatus, change: { providerTransactionId?: string | null; paidAt?: Date }): Promise<boolean> {
    const payment = this.payments.get(paymentId);
    if (payment?.status !== from) return false;
    this.payments.set(paymentId, { ...payment, ...change, status: to });
    return true;
  }

  public async addRefundedAmount(paymentId: string, amount: MinorUnits): Promise<boolean> {
    const payment = this.payments.get(paymentId);
    if (payment === undefined || payment.refundedAmount + amount > payment.amount) return false;
    this.payments.set(paymentId, { ...payment, refundedAmount: payment.refundedAmount + amount });
    return true;
  }
}

export class InMemoryWebhookEventsRepository implements WebhookEventsRepository {
  private readonly events = new Map<string, Date | null>();

  public async claimEvent(provider: string, eventKey: string): Promise<boolean> {
    const key = `${provider}:${eventKey}`;
    if (this.events.has(key)) return false;
    this.events.set(key, null);
    return true;
  }

  public async markEventProcessed(provider: string, eventKey: string, processedAt: Date): Promise<void> {
    this.events.set(`${provider}:${eventKey}`, processedAt);
  }

  public async releaseEvent(provider: string, eventKey: string): Promise<void> {
    this.events.delete(`${provider}:${eventKey}`);
  }
}
