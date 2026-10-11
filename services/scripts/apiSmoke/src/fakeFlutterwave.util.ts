import { stepUpUser, type UserActor } from "./actors.util.js";
import { callApi, describeResponse, waitFor, type ApiResponse } from "./apiClient.util.js";
import { bankAccountNumberFor } from "./commerceFixtures.util.js";

const fakeFlutterwaveUrl = process.env["SMOKE_FAKE_FLUTTERWAVE_URL"] ?? "http://127.0.0.1:18998";


interface SignedWebhook {
  readonly body: string;
  readonly signatureHeader: string;
  readonly signature: string;
}

async function controlFake(path: string): Promise<any> {
  const response = await fetch(`${fakeFlutterwaveUrl}${path}`, { method: "POST" });
  if (response.status !== 200) throw new Error(`fake Flutterwave ${path} ${response.status}: ${await response.text()}`);
  return response.json();
}

export function deliverFlutterwaveWebhook(signed: SignedWebhook, hash = signed.signature): Promise<ApiResponse> {
  return callApi("POST", "/webhooks/flutterwave", { rawBody: signed.body, headers: { "content-type": "application/json", "verif-hash": hash }, idempotent: false });
}

async function deliverOrThrow(signed: SignedWebhook): Promise<void> {
  const delivered = await deliverFlutterwaveWebhook(signed);
  if (delivered.status !== 200) throw new Error(`webhook delivery: ${describeResponse(delivered)}`);
}

export async function signFunding(nuban: string, amountMinor: number, reference: string, hintMinor = 0): Promise<SignedWebhook> {
  return controlFake(`/__smoke/wallets/${nuban}/fund?amount=${amountMinor}&reference=${encodeURIComponent(reference)}&hint=${hintMinor}`);
}

export async function fundWallet(nuban: string, amountMinor: number, reference: string): Promise<void> {
  await deliverOrThrow(await signFunding(nuban, amountMinor, reference));
}

export async function payCardCheckout(reference: string, feeMinor = 0, amountOverrideMinor = 0, card: "good" | "decline" = "good"): Promise<void> {
  await deliverOrThrow(await controlFake(`/__smoke/charges/${encodeURIComponent(reference)}/complete?fee=${feeMinor}&amount=${amountOverrideMinor}&card=${card}`));
}

export function payCheckoutThroughProvider(reference: string, feeMinor = 0, card: "good" | "decline" = "good"): Promise<void> {
  return payCardCheckout(reference, feeMinor, 0, card);
}

export function settleTransferThroughProvider(reference: string, status: "success" | "failed" = "success"): Promise<void> {
  return finishTransfer(reference, status === "success" ? "successful" : "failed");
}

export interface ProviderTransfer {
  readonly Reference: string;
  readonly Status: string;
  readonly AmountMinor: number;
  readonly DebitSubaccount: string;
  readonly SkipBeneficiary: boolean;
}

export async function readProviderState(): Promise<{ readonly transactions: number; readonly transfers: Record<string, ProviderTransfer>; readonly refunds: Array<Record<string, unknown>> | null; readonly requests: string[] }> {
  return (await fetch(`${fakeFlutterwaveUrl}/__smoke/state`)).json() as never;
}

export function isOpenProviderTransfer(transfer: ProviderTransfer): boolean {
  return transfer.Status === "NEW" || transfer.Status === "PENDING";
}

export async function finishTransfer(reference: string, outcome: "successful" | "failed" = "successful"): Promise<void> {
  await deliverOrThrow(await controlFake(`/__smoke/transfers/${encodeURIComponent(reference)}/${outcome}`));
}

export function settle(currency: string): Promise<{ settlementId: string }> {
  return controlFake(`/__smoke/settle/${currency}`);
}

export function readFakeFlutterwaveState(): ReturnType<typeof readProviderState> {
  return readProviderState();
}

export function userStepUp(user: UserActor): Promise<string> {
  return stepUpUser(user);
}

export async function verifyNigerianUserToLevelOne(user: UserActor): Promise<{ accountNumber: string }> {
  await callApi("PATCH", "/api/v1/users/me/preferences", { token: user.accessToken, body: { countryCode: "NG" } });
  const accountNumber = bankAccountNumberFor(user.accountId);
  const identity = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/identity?role=seller", { token: user.accessToken, body: { legalName: "Temitope Adeyemi", dateOfBirth: "1994-02-03", addressLine1: "4 Allen Avenue", city: "Ikeja", state: "Lagos", idType: "bvn", idNumber: "22212345678", registeredBusiness: false } });
  if (identity.status >= 300) throw new Error(`identity: ${describeResponse(identity)}`);
  const resolved = await callApi("POST", "/api/v1/payments/payout-onboarding/me/resolve", { token: user.accessToken, body: { bankCode: "058", accountNumber } });
  const bank = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/bank", { token: user.accessToken, headers: { "x-step-up-token": await userStepUp(user) }, body: { bankCode: "058", bankName: "Guaranty Trust Bank", accountNumber, resolvedAccountName: resolved.body?.accountName ?? "Temitope Adeyemi" } });
  if (bank.status >= 300) throw new Error(`bank: ${describeResponse(bank)}`);
  const consent = await callApi("POST", "/api/v1/payments/payout-onboarding/me/bank-validation", { token: user.accessToken });
  if (consent.status !== 202 || typeof consent.body?.consentUrl !== "string") throw new Error(`bvn consent: ${describeResponse(consent)}`);
  const verified = await waitFor(async () => {
    const state = await callApi("GET", "/api/v1/payments/payout-onboarding/me/bank-validation", { token: user.accessToken });
    return state.body?.status === "verified" ? state : undefined;
  }, 30_000, 1000);
  if (verified === undefined) throw new Error("BVN consent never verified");
  const level = await waitFor(async () => {
    const view = await callApi("GET", "/api/v1/payments/verification/me", { token: user.accessToken });
    return view.body?.level >= 1 ? view : undefined;
  }, 90_000, 2000);
  if (level === undefined) throw new Error("user never reached L1");
  const wallet = await callApi("POST", "/api/v1/payments/wallet/me/activate", { token: user.accessToken });
  if (wallet.status !== 201) throw new Error(`wallet: ${describeResponse(wallet)}`);
  return { accountNumber: wallet.body.wallet.accountNumber };
}

export async function readWallet(user: UserActor): Promise<{ availableMinor: number; depositHoldMinor: number; escrowLockedMinor: number; outgoingMinor: number; reservedPayoutMinor: number; debtMinor: number }> {
  const view = await callApi("GET", "/api/v1/payments/wallet/me", { token: user.accessToken });
  if (view.status !== 200) throw new Error(`wallet view: ${describeResponse(view)}`);
  return view.body.balances;
}
