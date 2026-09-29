import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider, PaymentStatus } from "../../../enums/paymentStatus.enum.js";
import type { Payment } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { MinorUnits } from "../../../types/money.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { NewPayment, PaymentRecord } from "../models/payments.model.js";
import type { PaymentsRepository, WebhookEventsRepository } from "./payments.repository.js";

function convertPaymentRowToRecord(row: Payment): PaymentRecord {
  return {
    ...row,
    provider: row.provider as PaymentProvider,
    currency: row.currency as CurrencyCode,
    status: row.status as PaymentStatus,
    amount: convertDatabaseAmountToMinorUnits(row.amount),
    refundedAmount: convertDatabaseAmountToMinorUnits(row.refundedAmount),
  };
}

export class PrismaPaymentsRepository implements PaymentsRepository {
  public async create(input: NewPayment): Promise<PaymentRecord> {
    return convertPaymentRowToRecord(await prisma().payment.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async saveAuthorizationUrl(paymentId: string, authorizationUrl: string): Promise<void> {
    await prisma().payment.updateMany({ where: { id: paymentId }, data: { authorizationUrl } });
  }

  public async findById(paymentId: string): Promise<PaymentRecord | undefined> {
    const row = await prisma().payment.findUnique({ where: { id: paymentId } });
    return row === null ? undefined : convertPaymentRowToRecord(row);
  }

  public async findByReference(reference: string): Promise<PaymentRecord | undefined> {
    const row = await prisma().payment.findUnique({ where: { reference } });
    return row === null ? undefined : convertPaymentRowToRecord(row);
  }

  public async listForCheckout(checkoutId: string): Promise<readonly PaymentRecord[]> {
    const rows = await prisma().payment.findMany({ where: { checkoutId }, orderBy: { createdAt: "desc" } });
    return rows.map(convertPaymentRowToRecord);
  }

  public async changeStatus(paymentId: string, from: PaymentStatus, to: PaymentStatus, change: { providerTransactionId?: string | null; paidAt?: Date }): Promise<boolean> {
    return (await prisma().payment.updateMany({ where: { id: paymentId, status: from }, data: { ...change, status: to } })).count === 1;
  }

  public async addRefundedAmount(paymentId: string, amount: MinorUnits): Promise<boolean> {
    const payment = await this.findById(paymentId);
    if (payment === undefined) return false;
    const result = await prisma().payment.updateMany({
      where: { id: paymentId, refundedAmount: { lte: BigInt(payment.amount - amount) } },
      data: { refundedAmount: { increment: BigInt(amount) } },
    });
    return result.count === 1;
  }
}

export class PrismaWebhookEventsRepository implements WebhookEventsRepository {
  public async claimEvent(provider: string, eventKey: string): Promise<boolean> {
    try {
      await prisma().webhookEvent.create({ data: { provider, eventKey } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async markEventProcessed(provider: string, eventKey: string, processedAt: Date): Promise<void> {
    await prisma().webhookEvent.updateMany({ where: { provider, eventKey }, data: { processedAt } });
  }

  public async releaseEvent(provider: string, eventKey: string): Promise<void> {
    await prisma().webhookEvent.deleteMany({ where: { provider, eventKey, processedAt: null } });
  }
}
