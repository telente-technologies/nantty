import { schema } from "@zudojs/schema";

export const InitializePaymentBodySchema = schema.object({
  orderId: schema.string().uuid(),
  provider: schema.enum(["paystack", "flutterwave"]),
});

export const OrderPaymentParamsSchema = schema.object({ orderId: schema.string().uuid() });

export const PaymentParamsSchema = schema.object({ id: schema.string().uuid() });

export const WebhookParamsSchema = schema.object({ provider: schema.enum(["paystack", "flutterwave"]) });
