import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { readRawRequestBody, type WebhookVerifier } from "../../../middlewares/verifyWebhookSignature.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { convertEscrowToDto } from "../../escrows/dtos/escrows.dto.js";
import type { EscrowRecord } from "../../escrows/models/escrows.model.js";
import { OrderParamsSchema } from "../../orders/validators/orders.validator.js";
import { HandlePaymentWebhookCommand } from "../commands/handlePaymentWebhook/handlePaymentWebhook.command.js";
import { InitializePaymentCommand } from "../commands/initializePayment/initializePayment.command.js";
import { RefundPaymentCommand } from "../commands/refundPayment/refundPayment.command.js";
import { VerifyPaymentCommand } from "../commands/verifyPayment/verifyPayment.command.js";
import { convertPaymentToDto } from "../dtos/payments.dto.js";
import type { PaymentGateway } from "../gateways/paymentGateway.interface.js";
import type { PaymentRecord } from "../models/payments.model.js";
import { GetPaymentQuery } from "../queries/getPayment/getPayment.query.js";
import { ListCheckoutPaymentsQuery } from "../queries/listCheckoutPayments/listCheckoutPayments.query.js";
import type { InitializedOrderPayment,
  OrderPaymentStatus, WebhookOutcome } from "../services/payments.service.js";
import { InitializePaymentBodySchema, PaymentParamsSchema, OrderPaymentParamsSchema, WebhookParamsSchema } from "../validators/payments.validator.js";

export class PaymentsController {
  public readonly webhookVerifiers: Readonly<Record<string, WebhookVerifier>>;

  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus, gateways: Readonly<Record<string, PaymentGateway>>) {
    this.webhookVerifiers = Object.fromEntries(
      Object.entries(gateways).map(([provider, gateway]) => [provider, (rawBody: Uint8Array, readHeader: (name: string) => string | undefined) => gateway.verifyWebhookSignature(rawBody, readHeader)]),
    );
  }

  public readonly initialize = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = InitializePaymentBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new InitializePaymentCommand(requireAuthenticatedPrincipal(ctx), body.data.orderId, body.data.provider);
    const result = await this.commands.execute<InitializePaymentCommand, InitializedOrderPayment>(command);
    return json(201, { orderId: result.orderId, reference: result.reference, authorizationUrl: result.authorizationUrl, payment: convertPaymentToDto(result.payment) });
  };

  public readonly verify = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderPaymentParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new VerifyPaymentCommand(requireAuthenticatedPrincipal(ctx), params.data.orderId);
    return json(200, { status: await this.commands.execute<VerifyPaymentCommand, OrderPaymentStatus>(command) });
  };

  public readonly receiveWebhook = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = WebhookParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new HandlePaymentWebhookCommand(params.data.provider, readRawRequestBody(ctx.request.body));
    const outcome = await this.commands.execute<HandlePaymentWebhookCommand, WebhookOutcome>(command);
    return json(200, { received: true, duplicate: outcome.duplicate });
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PaymentParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const payment = await this.queries.execute<GetPaymentQuery, PaymentRecord>(new GetPaymentQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, convertPaymentToDto(payment));
  };

  public readonly listForCheckout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PaymentParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const payments = await this.queries.execute<ListCheckoutPaymentsQuery, readonly PaymentRecord[]>(new ListCheckoutPaymentsQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, payments.map(convertPaymentToDto));
  };

  public readonly refundOrder = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const escrow = await this.commands.execute<RefundPaymentCommand, EscrowRecord>(new RefundPaymentCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, { escrow: convertEscrowToDto(escrow) });
  };
}
