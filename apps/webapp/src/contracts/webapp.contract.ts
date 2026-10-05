import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const userSummary = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) });
const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), bio: c.string() });
const reason = c.string(["taken", "reserved", "invalid", "recently_used", "withheld"]);

export const webappContracts: readonly EndpointContract[] = [
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "zudomart@test.com", password: "x" }, schema: c.object({ accessToken: c.string(), refreshToken: c.string(), user }) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=admin", schema: c.object({ available: c.boolean(), reason }, []) },
  { domain: "users", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "users", method: "GET", path: "/api/v1/users/me/addresses", schema: c.page(c.object({ id: c.string(), line1: c.string(), city: c.string(), state: c.string(), isDefault: c.boolean() })) },
  { domain: "users", method: "GET", path: "/api/v1/locale/countries", schema: c.page(c.object({ countryCode: c.string(), countryName: c.string(), currency: c.string() })) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/username-policy", schema: c.object({ username: c.string(), canChangeNow: c.boolean(), cooldownDays: c.number(), maxChangesPerYear: c.number(), quarantineDays: c.number(), history: c.array(c.any()) }) },
  {
    domain: "chatKeys",
    method: "POST",
    path: "/api/v1/chat/keys/devices/query",
    body: { userIds: ["u_21"] },
    schema: c.object({ data: c.array(c.object({ userId: c.string(), devices: c.array(c.object({ deviceId: c.string(), registrationId: c.number(), identityKey: c.string() })) })) }),
  },
  {
    domain: "chatKeys",
    method: "POST",
    path: "/api/v1/chat/keys/bundles",
    body: { devices: [{ userId: "u_21", deviceId: "unknown-device" }] },
    schema: c.object({ data: c.array(c.any()) }),
  },
  { domain: "live", method: "GET", path: "/api/v1/lives/suggested", schema: c.page(c.object({ id: c.string(), host: userSummary, title: c.string(), coverUrl: c.nullable(c.string()) })) },
];
