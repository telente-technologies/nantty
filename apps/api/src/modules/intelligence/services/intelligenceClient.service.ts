import type { IntelligenceSettings } from "../../../configs/intelligence.config.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { CircuitBreaker } from "./circuitBreaker.service.js";
import type { IntelligenceHttpResponse, IntelligenceTransport } from "./intelligenceTransport.service.js";
import { createRequestNonce, signIntelligenceRequest } from "./requestSigning.service.js";

export type IntelligenceTimeoutFamily = keyof IntelligenceSettings["timeouts"];

export type IntelligenceFailureReason = "disabled" | "circuit_open" | "timeout" | "network_error" | "http_error" | "invalid_response";

export type IntelligenceCallResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: IntelligenceFailureReason; readonly status?: number };

class IntelligenceTimeoutError extends Error {}

const TIMED_OUT = Symbol("timed-out");

export class SignedIntelligenceClient {
  public constructor(
    private readonly settings: IntelligenceSettings,
    private readonly transport: IntelligenceTransport,
    private readonly breaker: CircuitBreaker,
    private readonly logger: AppLogger,
  ) {}

  public isEnabled(): boolean {
    return this.settings.baseUrl !== "" && this.settings.sharedSecret !== "";
  }

  public circuitState() {
    return this.breaker.currentState();
  }

  public async post<T>(path: string, payload: unknown, family: IntelligenceTimeoutFamily): Promise<IntelligenceCallResult<T>> {
    if (!this.isEnabled()) return { ok: false, reason: "disabled" };
    if (!this.breaker.tryAcquirePermission()) return { ok: false, reason: "circuit_open" };
    const body = JSON.stringify(payload);
    const headers = signIntelligenceRequest({
      secret: this.settings.sharedSecret,
      method: "POST",
      pathWithQuery: path,
      body,
      timestampSeconds: Math.floor(Date.now() / 1000),
      nonce: createRequestNonce(),
    });
    let response: IntelligenceHttpResponse;
    try {
      response = await this.sendWithTimeout(path, body, headers, this.settings.timeouts[family]);
    } catch (error) {
      this.breaker.recordFailure();
      const reason = error instanceof IntelligenceTimeoutError ? "timeout" : "network_error";
      this.logger.warn("Intelligence request failed; using fallback", { path, reason });
      return { ok: false, reason };
    }
    if (response.status >= 500 || response.status === 429) this.breaker.recordFailure();
    else this.breaker.recordSuccess();
    if (response.status < 200 || response.status >= 300) {
      this.logger.warn("Intelligence request was refused; using fallback", { path, status: response.status });
      return { ok: false, reason: "http_error", status: response.status };
    }
    try {
      return { ok: true, value: JSON.parse(response.body) as T };
    } catch {
      return { ok: false, reason: "invalid_response", status: response.status };
    }
  }

  private async sendWithTimeout(path: string, body: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<IntelligenceHttpResponse> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    });
    try {
      const request = this.transport.send({ method: "POST", url: `${this.settings.baseUrl}${path}`, pathWithQuery: path, headers, body, signal: controller.signal });
      request.catch(() => undefined);
      const outcome = await Promise.race([request, timeout]);
      if (outcome === TIMED_OUT) {
        controller.abort();
        throw new IntelligenceTimeoutError(`Intelligence request to ${path} timed out after ${timeoutMs} ms.`);
      }
      return outcome;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
