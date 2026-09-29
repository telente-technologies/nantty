import { schema } from "@zudojs/schema";

export const InitializePaymentBodySchema = schema.object({
  checkoutId: schema.string().uuid(),
  provider: schema.enum(["paystack", "flutterwave"]),
});

export const VerifyPaymentBodySchema = schema.object({ reference: schema.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/) });

export const PaymentParamsSchema = schema.object({ id: schema.string().uuid() });

export const WebhookParamsSchema = schema.object({ provider: schema.enum(["paystack", "flutterwave"]) });
