import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { IdentityCaptureSession } from "@/types/identityVerification.type";
import { openSmileIdCapture, runSmileIdCapture, smileIdFailureMessage } from "./smileIdWebIntegration.service";

type SmileResult =
  | { readonly status: "success"; readonly value?: unknown; readonly product?: string }
  | { readonly status: "cancelled"; readonly value?: unknown; readonly product?: string }
  | { readonly status: "failure"; readonly product?: string; readonly error: { readonly error_code: string; readonly message: string; readonly status: number; readonly retryable: boolean } };

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const session: IdentityCaptureSession = {
  mode: "web_integration", token: "short-lived-token", product: "document_verification", caseId: "case-1", captureAttemptId: "attempt-1",
  partnerId: "1", environment: "sandbox", callbackUrl: "https://api.nantty.test/webhook",
};

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("Smile ID Web SDK result handling", () => {
  it("distinguishes user cancellation from an accepted submission", async () => {
    let deliver: ((result: SmileResult) => void) | undefined;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult) => void }) => { deliver = options.onResult; } } });

    const result = openSmileIdCapture(session, "https://nantty.com/privacy");
    await Promise.resolve();
    assert.ok(deliver);
    deliver?.({ status: "cancelled" });
    assert.equal(await result, "cancelled");
  });

  it("cancels only explicit SDK cancellations and leaves provider failures pending", async () => {
    let deliver: ((result: SmileResult) => void) | undefined;
    let cancelCalls = 0;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult) => void }) => { deliver = options.onResult; } } });

    const result = runSmileIdCapture(session, "https://nantty.com/privacy", async (caseId, attemptId) => {
      assert.equal(caseId, session.caseId);
      assert.equal(attemptId, session.captureAttemptId);
      cancelCalls += 1;
      return { cancelled: true };
    });
    await Promise.resolve();
    deliver?.({ status: "cancelled" });
    assert.equal(await result, "cancelled");
    assert.equal(cancelCalls, 1);

    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult) => void }) => { deliver = options.onResult; } } });
    const failed = runSmileIdCapture(session, "https://nantty.com/privacy", async () => {
      cancelCalls += 1;
      return { cancelled: true };
    });
    await Promise.resolve();
    deliver?.({ status: "failure", product: session.product, error: { error_code: "SUBMISSION_FAILED", message: "provider detail", status: 503, retryable: true } });
    await assert.rejects(failed, /only start another session after Nantty confirms this attempt is closed/i);
    assert.equal(cancelCalls, 1);

    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult) => void }) => { deliver = options.onResult; } } });
    const terminal = runSmileIdCapture(session, "https://nantty.com/privacy", async () => { cancelCalls += 1; return { cancelled: true }; });
    await Promise.resolve();
    deliver?.({ status: "failure", product: session.product, error: { error_code: "SUBMISSION_FAILED", message: "provider detail", status: 400, retryable: false } });
    await assert.rejects(terminal, /could not confirm that your check was accepted/i);
    assert.equal(cancelCalls, 1);
  });

  it("reports success only as submission, never as a verification verdict", async () => {
    let deliver: ((result: SmileResult) => void) | undefined;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult) => void }) => { deliver = options.onResult; } } });

    const result = openSmileIdCapture(session, "https://nantty.com/privacy");
    await Promise.resolve();
    assert.ok(deliver);
    deliver?.({ status: "success", product: session.product, value: { status: "accepted" } });
    assert.equal(await result, "submitted");
  });

  it("accepts the documented product-less cancellation but rejects a mismatched product", async () => {
    let deliver: ((result: SmileResult & { readonly product?: string }) => void) | undefined;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult & { readonly product?: string }) => void }) => { deliver = options.onResult; } } });

    const cancelled = openSmileIdCapture(session, "https://nantty.com/privacy");
    await Promise.resolve();
    deliver?.({ status: "cancelled" });
    assert.equal(await cancelled, "cancelled");

    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult & { readonly product?: string }) => void }) => { deliver = options.onResult; } } });
    const mismatched = openSmileIdCapture(session, "https://nantty.com/privacy");
    await Promise.resolve();
    deliver?.({ status: "success", product: "enhanced_document_verification" });
    await assert.rejects(mismatched, /different verification method/i);
  });

  it("maps provider failures to actionable, non-sensitive guidance", () => {
    const message = smileIdFailureMessage({ status: "failure", error: { error_code: "NOT_PERMITTED", message: "partner disabled", status: 403, retryable: true } });
    assert.match(message, /could not run this check right now/i);
    assert.doesNotMatch(message, /partner disabled/i);
  });

  it("uses retryability for session and submission failures", () => {
    const retryable = { status: "failure" as const, error: { error_code: "SESSION_INIT_FAILED", message: "raw provider error", status: 503, retryable: true } };
    const terminal = { status: "failure" as const, error: { error_code: "SESSION_INIT_FAILED", message: "raw provider error", status: 400, retryable: false } };
    assert.match(smileIdFailureMessage(retryable), /if the unsuccessful attempt is closed/i);
    assert.match(smileIdFailureMessage({ status: "failure", error: { error_code: "SUBMISSION_FAILED", message: "provider detail", status: 503, retryable: true } }), /only start a new session if Nantty confirms this attempt was closed/i);
    assert.match(smileIdFailureMessage(terminal), /contact Nantty support/i);
  });

  it("does not request cancellation for a retryable provider failure", async () => {
    let deliver: ((result: SmileResult) => void) | undefined;
    let cancelCalls = 0;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nantty.com" }, SmileIdentity: (options: { onResult: (result: SmileResult) => void }) => { deliver = options.onResult; } } });
    const failed = runSmileIdCapture(session, "https://nantty.com/privacy", async () => { cancelCalls += 1; return { cancelled: false }; });
    await Promise.resolve();
    deliver?.({ status: "failure", product: session.product, error: { error_code: "SESSION_INIT_FAILED", message: "provider detail", status: 503, retryable: true } });
    await assert.rejects(failed, /only start another session after Nantty confirms this attempt is closed/i);
    assert.equal(cancelCalls, 0);
  });

  it("does not recommend repeating non-retryable document or product rejections", () => {
    const documentRejected = { status: "failure" as const, error: { error_code: "DOCUMENTS_REJECTED", message: "provider details", status: 422, retryable: false } };
    const productRejected = { status: "failure" as const, error: { error_code: "NOT_PERMITTED", message: "provider details", status: 403, retryable: false } };
    assert.match(smileIdFailureMessage(documentRejected), /choose another supported ID/i);
    assert.doesNotMatch(smileIdFailureMessage(documentRejected), /then try again/i);
    assert.match(smileIdFailureMessage(productRejected), /choose another supported ID/i);
  });
});
