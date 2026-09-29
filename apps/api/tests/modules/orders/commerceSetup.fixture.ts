import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../src/enums/currency.enum.js";
import type { PaymentProvider } from "../../../src/enums/paymentStatus.enum.js";
import type { ExchangeRateProvider, FetchedExchangeRates } from "../../../src/modules/currency/services/exchangeRateProvider.service.js";
import { parseDecimalRateToScaledInteger } from "../../../src/utils/exchangeRate.util.js";
import type {
  BankTransferRequest,
  BankTransferResult,
  HeaderReader,
  InitializePaymentRequest,
  PaymentGateway,
  RefundPaymentRequest,
  VerifiedPayment,
  WebhookNotice,
} from "../../../src/modules/payments/gateways/paymentGateway.interface.js";
import { createTestApplication, type SignedInUser, type TestApplication } from "../../fixtures/testApplication.fixture.js";

export const FAKE_WEBHOOK_SECRET = "fake-webhook-secret";

export class FakePaymentGateway implements PaymentGateway {
  public readonly initialized: InitializePaymentRequest[] = [];
  public readonly refunds: RefundPaymentRequest[] = [];
  public readonly transfers: BankTransferRequest[] = [];
  public readonly verifyCalls: string[] = [];
  public verificationOverrides = new Map<string, Partial<VerifiedPayment>>();
  public transferResult: BankTransferResult = { status: "succeeded", recipientCode: "RCP_fake", failureReason: null };

  public constructor(public readonly provider: PaymentProvider) {}

  public async initializePayment(request: InitializePaymentRequest) {
    this.initialized.push(request);
    return { authorizationUrl: `https://checkout.fake/${request.reference}` };
  }

  public async verifyPayment(reference: string): Promise<VerifiedPayment> {
    this.verifyCalls.push(reference);
    const request = this.initialized.find((entry) => entry.reference === reference);
    return {
      status: "succeeded",
      amount: request?.amount ?? 0,
      currency: request?.currency ?? "NGN",
      providerTransactionId: `txn_${reference}`,
      ...this.verificationOverrides.get(reference),
    };
  }

  public async refundPayment(request: RefundPaymentRequest): Promise<void> {
    this.refunds.push(request);
  }

  public verifyWebhookSignature(_rawBody: Uint8Array, readHeader: HeaderReader): boolean {
    return readHeader("x-fake-signature") === FAKE_WEBHOOK_SECRET;
  }

  public readWebhookNotice(rawBody: Uint8Array): WebhookNotice {
    const body = JSON.parse(new TextDecoder().decode(rawBody)) as { id: string; reference: string };
    return { eventKey: body.id, reference: body.reference };
  }

  public async transferToBank(request: BankTransferRequest): Promise<BankTransferResult> {
    this.transfers.push(request);
    return this.transferResult;
  }
}

export class AdjustableExchangeRateProvider implements ExchangeRateProvider {
  public unitsPerUsDollar: Record<string, string> = { NGN: "1500", GHS: "15", KES: "130", ZAR: "18", GBP: "0.8", EUR: "0.9" };

  public async fetchUnitsPerUsDollar(): Promise<FetchedExchangeRates> {
    return {
      source: "test-rates",
      scaledUnitsPerUsDollar: Object.fromEntries(Object.entries(this.unitsPerUsDollar).map(([currency, rate]) => [currency, parseDecimalRateToScaledInteger(rate)])),
    };
  }
}

export interface ProductSetup {
  readonly currency?: CurrencyCode;
  readonly price?: number;
  readonly stock?: number;
  readonly shippingFee?: number;
  readonly discountBps?: number;
}

export interface StoreWithProduct {
  readonly seller: SignedInUser;
  readonly storeId: string;
  readonly productId: string;
  readonly variantId: string;
}

export interface MoneyShape {
  readonly amountMinor: number;
  readonly currency: string;
}

export function naira(amountMinor: number): MoneyShape {
  return { amountMinor, currency: "NGN" };
}

export function createIdempotencyKey(): string {
  return `test-${randomUUID()}`;
}

export function createCommerceTestApplication() {
  const paystack = new FakePaymentGateway("paystack");
  const flutterwave = new FakePaymentGateway("flutterwave");
  const exchangeRates = new AdjustableExchangeRateProvider();
  const app = createTestApplication({ external: { paymentGateways: { paystack, flutterwave }, exchangeRateProvider: exchangeRates } });

  async function registerBuyer(countryCode = "NG"): Promise<SignedInUser> {
    const buyer = await app.registerUser();
    await app.client.patch("/api/v1/users/me/preferences").auth(buyer.accessToken).send({ countryCode }).expect(200);
    return buyer;
  }

  async function refreshExchangeRates(): Promise<void> {
    const admin = await app.registerAdmin();
    await app.client.post("/api/v1/admin/exchange-rates/refresh").auth(admin.accessToken).expect(200);
  }

  async function createStoreWithProduct(setup: ProductSetup = {}, existingSeller?: SignedInUser): Promise<StoreWithProduct> {
    const seller = existingSeller ?? (await app.registerSeller());
    const store = await app.client
      .post("/api/v1/stores")
      .auth(seller.accessToken)
      .send({ name: `Shop ${randomUUID().slice(0, 6)}`, currency: setup.currency ?? "NGN", shippingFee: setup.shippingFee ?? 0, discountBps: setup.discountBps ?? 0 })
      .expect(201);
    const storeId = store.json<{ id: string }>().id;
    const product = await app.client
      .post(`/api/v1/stores/${storeId}/products`)
      .auth(seller.accessToken)
      .send({ title: "Ankara Dress", price: setup.price ?? 10_000, stock: setup.stock ?? 12 })
      .expect(201);
    const created = product.json<{ id: string; variants: { id: string }[] }>();
    await app.client.post(`/api/v1/stores/${storeId}/products/${created.id}/publish`).auth(seller.accessToken).expect(200);
    return { seller, storeId, productId: created.id, variantId: created.variants[0]?.id ?? "" };
  }

  async function addToCart(buyer: SignedInUser, variantId: string, quantity: number): Promise<void> {
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ variantId, quantity }).expect(201);
  }

  async function checkout(buyer: SignedInUser) {
    const response = await app.client
      .post("/api/v1/checkout")
      .auth(buyer.accessToken)
      .set("idempotency-key", createIdempotencyKey())
      .send({ shippingAddress: { fullName: "Ada Buyer", phone: "08031234567", line1: "12 Allen Avenue", city: "Ikeja", state: "Lagos" } })
      .expect(201);
    return response.json<{ checkout: { id: string; total: MoneyShape }; orders: { id: string; storeId: string; total: MoneyShape; status: string; charged: { total: MoneyShape; exchangeRate: string } }[] }>();
  }

  async function payCheckout(buyer: SignedInUser, checkoutId: string): Promise<{ reference: string; paymentId: string }> {
    const initialized = await app.client
      .post("/api/v1/payments/initialize")
      .auth(buyer.accessToken)
      .set("idempotency-key", createIdempotencyKey())
      .send({ checkoutId, provider: "paystack" })
      .expect(201);
    const payment = initialized.json<{ payment: { id: string; reference: string } }>().payment;
    await app.client.post("/api/v1/payments/verify").auth(buyer.accessToken).send({ reference: payment.reference }).expect(200);
    return { reference: payment.reference, paymentId: payment.id };
  }

  async function buyAndPay(buyer: SignedInUser, store: StoreWithProduct, quantity = 1) {
    await addToCart(buyer, store.variantId, quantity);
    const placed = await checkout(buyer);
    await payCheckout(buyer, placed.checkout.id);
    return placed;
  }

  return { ...app, paystack, flutterwave, exchangeRates, registerBuyer, refreshExchangeRates, createStoreWithProduct, addToCart, checkout, payCheckout, buyAndPay };
}

export type CommerceTestApplication = ReturnType<typeof createCommerceTestApplication> & TestApplication;
