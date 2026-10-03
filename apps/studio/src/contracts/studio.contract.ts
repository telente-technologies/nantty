import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), email: c.string() });
const session = c.object({ accessToken: c.string(), refreshToken: c.string(), user });
const liveComment = c.object({ id: c.string(), author: c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) }), text: c.string(), createdAt: c.string() });

export const studioContracts: readonly EndpointContract[] = [
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "creator@zudomart.com", password: "x" }, schema: session },
  { domain: "auth", method: "POST", path: "/api/v1/auth/google", body: { idToken: "a.b.c", nonce: "raw" }, schema: session },
  { domain: "auth", method: "POST", path: "/api/v1/auth/apple", body: { identityToken: "a.b.c", nonce: "raw" }, schema: session },
  { domain: "auth", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/comments", schema: c.page(liveComment) },
];
