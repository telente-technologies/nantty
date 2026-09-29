import { randomBytes } from "node:crypto";

import { requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { appendMockActivity, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, failValidation, readJsonObjectBody, requirePrincipal, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { AdAccountRole } from "@/types/adAccount.type";
import { isValidEmailAddress } from "@/utils/formValidation.util";

const assignableRoles: readonly AdAccountRole[] = ["admin", "advertiser", "analyst", "billing"];

function readAssignableRole(value: unknown): AdAccountRole {
  return assignableRoles.includes(value as AdAccountRole) ? (value as AdAccountRole) : failValidation("role", "Choose admin, advertiser, analyst or billing.");
}

export function registerMembersMockHandlers(): void {
  registerMockRoute("GET", "/ads/accounts/:accountId/members", (request) => {
    const { account } = requireAccountAccess(request, "account:view");
    const database = readMockDatabase();
    const items = database.members
      .filter((member) => member.accountId === account.id)
      .map((member) => {
        const user = database.users.find((candidate) => candidate.id === member.userId);
        return { userId: member.userId, name: user?.name ?? "Member", username: user?.username ?? "", avatarUrl: user?.avatarUrl ?? null, role: member.role, addedAt: member.addedAt, lastActiveAt: member.lastActiveAt, isOwner: member.userId === account.ownerUserId };
      });
    return respondWithJson(200, { items });
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/members/:userId", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "members:manage");
    const database = readMockDatabase();
    const member = database.members.find((candidate) => candidate.accountId === account.id && candidate.userId === request.params.userId);
    if (!member) throw new MockHttpError(404, "NOT_FOUND", "That person is not on this ad account.");
    if (member.userId === account.ownerUserId) throw new MockHttpError(409, "OWNER_ROLE_LOCKED", "The account owner is always an admin.");
    const role = readAssignableRole(readJsonObjectBody(request).role);
    const previousRole = member.role;
    member.role = role;
    const user = database.users.find((candidate) => candidate.id === member.userId);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "member_role_changed", objectType: "member", objectId: member.userId, objectName: user?.name ?? member.userId, summary: "Changed role", changes: [{ field: "Role", from: previousRole, to: role }] });
    return respondWithJson(200, { userId: member.userId, name: user?.name ?? "", username: user?.username ?? "", avatarUrl: null, role, addedAt: member.addedAt, lastActiveAt: member.lastActiveAt, isOwner: false });
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/members/:userId", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "members:manage");
    const database = readMockDatabase();
    const index = database.members.findIndex((candidate) => candidate.accountId === account.id && candidate.userId === request.params.userId);
    if (index < 0) throw new MockHttpError(404, "NOT_FOUND", "That person is not on this ad account.");
    if (request.params.userId === account.ownerUserId) throw new MockHttpError(409, "OWNER_CANNOT_BE_REMOVED", "The account owner cannot be removed.");
    database.members.splice(index, 1);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "member_removed", objectType: "member", objectId: request.params.userId ?? "", objectName: request.params.userId ?? "", summary: "Removed from the ad account", changes: [] });
    return respondWithNoContent();
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/invites", (request) => {
    const { account } = requireAccountAccess(request, "account:view");
    const items = readMockDatabase().invites.filter((invite) => invite.accountId === account.id && invite.status === "pending").map(({ token: _token, accountId: _accountId, ...invite }) => invite);
    return respondWithJson(200, { items });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/invites", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "members:manage");
    const body = readJsonObjectBody(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!isValidEmailAddress(email)) failValidation("email", "Enter a valid email address.");
    const role = readAssignableRole(body.role);
    const database = readMockDatabase();
    if (database.invites.some((invite) => invite.accountId === account.id && invite.email === email && invite.status === "pending")) failValidation("email", "This email already has a pending invite.");
    const alreadyMember = database.members.some((member) => member.accountId === account.id && database.users.find((user) => user.id === member.userId)?.email === email);
    if (alreadyMember) failValidation("email", "This person is already on the ad account.");
    const now = Date.now();
    const invite = { id: createMockId("inv"), accountId: account.id, token: randomBytes(18).toString("base64url"), email, role, invitedBy: actorName, status: "pending" as const, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 7 * 86_400_000).toISOString() };
    database.invites.push(invite);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "member_invited", objectType: "member", objectId: invite.id, objectName: email, summary: `Invited as ${role}`, changes: [] });
    const { token: _token, accountId: _accountId, ...publicInvite } = invite;
    return respondWithJson(201, publicInvite);
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/invites/:inviteId", (request) => {
    const { account } = requireAccountAccess(request, "members:manage");
    const invite = readMockDatabase().invites.find((candidate) => candidate.accountId === account.id && candidate.id === request.params.inviteId);
    if (!invite) throw new MockHttpError(404, "NOT_FOUND", "Invite not found.");
    invite.status = "revoked";
    return respondWithNoContent();
  });

  registerMockRoute("GET", "/ads/invites/:token", (request) => {
    requirePrincipal(request);
    const database = readMockDatabase();
    const invite = database.invites.find((candidate) => candidate.token === request.params.token && candidate.status === "pending" && Date.parse(candidate.expiresAt) > Date.now());
    if (!invite) throw new MockHttpError(404, "INVITE_NOT_FOUND", "This invite has expired or was already used.");
    const account = database.accounts.find((candidate) => candidate.id === invite.accountId);
    return respondWithJson(200, { accountName: account?.name ?? "Ad account", role: invite.role, invitedBy: invite.invitedBy, expiresAt: invite.expiresAt });
  });

  registerMockRoute("POST", "/ads/invites/:token/accept", (request) => {
    const principal = requirePrincipal(request);
    const database = readMockDatabase();
    const invite = database.invites.find((candidate) => candidate.token === request.params.token && candidate.status === "pending" && Date.parse(candidate.expiresAt) > Date.now());
    if (!invite) throw new MockHttpError(404, "INVITE_NOT_FOUND", "This invite has expired or was already used.");
    const user = database.users.find((candidate) => candidate.id === principal.userId);
    if (user?.email !== invite.email) throw new MockHttpError(403, "INVITE_EMAIL_MISMATCH", "This invite was sent to a different email address.");
    const existing = database.members.find((member) => member.accountId === invite.accountId && member.userId === principal.userId);
    if (existing) existing.role = invite.role;
    else database.members.push({ accountId: invite.accountId, userId: principal.userId, role: invite.role, addedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() });
    invite.status = "accepted";
    return respondWithJson(200, { accountId: invite.accountId });
  });
}
