import type { IdentityDirectory, RequesterProfile } from "../interfaces/identityDirectory.interface.js";

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (domain === "") return "";
  return `${local.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

export function createIdentityHttpDirectory(baseUrl: string, internalToken: string, timeoutMs = 4000): IdentityDirectory {
  const request = async (method: "GET" | "POST", path: string, body?: unknown): Promise<unknown | null> => {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      headers: { "x-internal-token": internalToken, accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`identity responded ${response.status}`);
    const text = await response.text();
    return text === "" ? {} : (JSON.parse(text) as unknown);
  };
  return {
    async findRequesterProfile(accountId): Promise<RequesterProfile | null> {
      try {
        const raw = (await request("GET", `/api/v1/internal/users/${encodeURIComponent(accountId)}/notification-recipient`)) as Record<string, unknown> | null;
        if (raw === null) return null;
        const firstName = typeof raw["firstName"] === "string" ? raw["firstName"] : "";
        const username = typeof raw["username"] === "string" ? raw["username"] : "";
        return { accountId, displayName: firstName || username || "Zudomart member", username, emailMasked: typeof raw["email"] === "string" ? maskEmail(raw["email"]) : "", status: typeof raw["status"] === "string" ? raw["status"] : "active" };
      } catch {
        return null;
      }
    },
    async recordStaffAudit(entry) {
      await request("POST", "/api/v1/internal/admin/audit-entries", entry).catch(() => undefined);
    },
  };
}
