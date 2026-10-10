import type { AdminAuditEntry, AudiencePage, AudienceSegment, IdentityDirectory } from "../interfaces/identityDirectory.interface.js";
import type { Recipient } from "../types/notification.type.js";

export class IdentityHttpDirectory implements IdentityDirectory {
  public constructor(private readonly baseUrl: string, private readonly internalToken: string, private readonly timeoutMs = 8000) {}

  public async getRecipient(accountId: string): Promise<Recipient | null> {
    const response = await this.request("GET", `/api/v1/internal/users/${encodeURIComponent(accountId)}/notification-recipient`);
    if (response === null) return null;
    const recipient = this.convertRecipient(response);
    return typeof (response as Record<string, unknown>)["marketingConsent"] === "boolean" ? recipient : { ...recipient, marketingConsent: await this.readMarketingConsentFromPrivacySettings(accountId) };
  }

  public async findRecipientByUsername(username: string): Promise<Recipient | null> {
    const response = await this.request("GET", `/api/v1/internal/users/by-username/${encodeURIComponent(username)}/notification-recipient`);
    return response === null ? null : this.convertRecipient(response);
  }

  public async getStaffEmail(staffId: string): Promise<string | null> {
    const response = await this.request("GET", `/api/v1/internal/admins/${encodeURIComponent(staffId)}/notification-recipient`);
    const email = (response as { email?: unknown } | null)?.email;
    return typeof email === "string" && email !== "" ? email : null;
  }

  public async listSegments(): Promise<readonly AudienceSegment[]> {
    const response = (await this.request("GET", "/api/v1/internal/notification-audience/segments")) as { data?: AudienceSegment[] } | null;
    return response?.data ?? [];
  }

  public async listAudiencePage(segmentId: string, cursor: string | null, limit: number): Promise<AudiencePage> {
    const query = new URLSearchParams({ limit: String(limit), ...(cursor === null ? {} : { cursor }) });
    const response = (await this.request("GET", `/api/v1/internal/notification-audience/${encodeURIComponent(segmentId)}?${query}`)) as { data?: unknown[]; nextCursor?: string | null } | null;
    return { data: (response?.data ?? []).map((entry) => this.convertRecipient(entry)), nextCursor: response?.nextCursor ?? null };
  }

  public async countAudience(segmentId: string): Promise<{ readonly total: number; readonly marketingConsentCount: number }> {
    const response = (await this.request("GET", `/api/v1/internal/notification-audience/${encodeURIComponent(segmentId)}/count`)) as { total?: number; marketingConsentCount?: number } | null;
    return { total: response?.total ?? 0, marketingConsentCount: response?.marketingConsentCount ?? 0 };
  }

  public async withdrawMarketingConsent(accountId: string): Promise<void> {
    const response = await this.request("POST", `/api/v1/internal/users/${encodeURIComponent(accountId)}/marketing-unsubscribe`);
    if (response === null) throw new Error("Account not found.");
  }

  public async recordAdminAudit(entry: AdminAuditEntry): Promise<void> {
    await this.request("POST", "/api/v1/internal/admin/audit-entries", entry);
  }

  private async readMarketingConsentFromPrivacySettings(accountId: string): Promise<boolean> {
    const settings = (await this.request("GET", `/api/v1/internal/users/${encodeURIComponent(accountId)}/privacy-settings`)) as { marketing?: unknown } | null;
    return settings?.marketing === true;
  }

  private convertRecipient(raw: unknown): Recipient {
    const value = raw as Record<string, unknown>;
    return {
      accountId: String(value["accountId"]),
      email: typeof value["email"] === "string" && value["email"] !== "" ? value["email"] : null,
      emailVerified: value["emailVerified"] === true,
      firstName: typeof value["firstName"] === "string" && value["firstName"] !== "" ? value["firstName"] : "there",
      username: typeof value["username"] === "string" ? value["username"] : "",
      marketingConsent: value["marketingConsent"] === true,
      status: typeof value["status"] === "string" ? value["status"] : "active",
      ...(typeof value["pushEnabled"] === "boolean" ? { pushEnabled: value["pushEnabled"] } : {}),
      ...(value["marketingFrequency"] === "weekly" || value["marketingFrequency"] === "important_only" || value["marketingFrequency"] === "off" ? { marketingFrequency: value["marketingFrequency"] } : {}),
    };
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown | null> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: { "x-internal-token": this.internalToken, accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`goIdentity responded ${response.status} for ${method} ${path.split("?")[0]}.`);
    const text = await response.text();
    return text === "" ? {} : JSON.parse(text);
  }
}
