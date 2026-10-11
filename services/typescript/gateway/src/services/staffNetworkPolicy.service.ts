export interface StaffNetworkPolicySource {
  isStaffAddressAllowed(staffId: string, address: string): Promise<boolean>;
}

export interface StaffNetworkRefusal {
  readonly status: number;
  readonly body: { readonly message: string; readonly code: string };
}

const unavailable: StaffNetworkRefusal = { status: 503, body: { message: "Staff authentication is unavailable.", code: "UNAVAILABLE" } };
const notAllowed: StaffNetworkRefusal = { status: 403, body: { message: "The admin console cannot be used from this network.", code: "IP_NOT_ALLOWED" } };

export class IdentityStaffNetworkPolicySource implements StaffNetworkPolicySource {
  private readonly cache = new Map<string, { readonly allowed: boolean; readonly expiresAt: number }>();

  public constructor(private readonly baseUrl: string, private readonly internalToken: string, private readonly ttlMs = 30_000, private readonly now: () => number = Date.now) {}

  public async isStaffAddressAllowed(staffId: string, address: string): Promise<boolean> {
    const key = `${staffId}|${address}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt > this.now()) return cached.allowed;
    const url = new URL(`/api/v1/internal/admins/${encodeURIComponent(staffId)}/network-policy`, this.baseUrl);
    url.searchParams.set("address", address);
    const response = await fetch(url, { headers: { "x-internal-token": this.internalToken }, signal: AbortSignal.timeout(2_000) });
    if (response.status !== 200) throw new Error(`staff network policy answered ${response.status}`);
    const decision = (await response.json()) as { allowed?: unknown };
    if (typeof decision.allowed !== "boolean") throw new Error("unreadable staff network policy answer");
    if (this.cache.size >= 10_000) this.cache.clear();
    this.cache.set(key, { allowed: decision.allowed, expiresAt: this.now() + this.ttlMs });
    return decision.allowed;
  }
}

function normalizeAddress(address: string | null | undefined): string | null {
  if (address === null || address === undefined || address === "") return null;
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export class StaffNetworkGate {
  public constructor(private readonly source: StaffNetworkPolicySource | undefined, private readonly failClosed: boolean) {}

  public async refuse(staffId: string, remoteAddress: string | null | undefined): Promise<StaffNetworkRefusal | undefined> {
    if (this.source === undefined) return this.failClosed ? unavailable : undefined;
    const address = normalizeAddress(remoteAddress);
    if (address === null) return notAllowed;
    try {
      return (await this.source.isStaffAddressAllowed(staffId, address)) ? undefined : notAllowed;
    } catch {
      return unavailable;
    }
  }
}
