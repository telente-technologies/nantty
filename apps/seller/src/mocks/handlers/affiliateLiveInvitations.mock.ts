import { isValidAffiliateCommissionBasisPoints, readAffiliatesMockState, recordAffiliateAuditEntry } from "@/mocks/affiliateLedger.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { createMockIdentifier, MockHttpError, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { LiveInvitation } from "@/types/affiliate.type";

const maximumProductsPerLiveInvitation = 20;
const maximumDaysAheadForLiveInvitation = 90;

function validateLiveInvitationBody(body: Record<string, unknown>): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (typeof body.creatorId !== "string" || body.creatorId.length === 0) issues.push({ path: "creatorId", message: "Choose a creator." });
  const productIds = body.productIds;
  if (!Array.isArray(productIds) || productIds.length === 0) issues.push({ path: "productIds", message: "Pick at least one product." });
  else if (productIds.length > maximumProductsPerLiveInvitation) issues.push({ path: "productIds", message: `Pick at most ${maximumProductsPerLiveInvitation} products.` });
  else if (!productIds.every((productId) => typeof productId === "string")) issues.push({ path: "productIds", message: "Product list is invalid." });
  const startAt = typeof body.proposedStartAt === "string" ? new Date(body.proposedStartAt) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) issues.push({ path: "proposedStartAt", message: "Pick a start date and time." });
  else if (startAt.getTime() <= Date.now()) issues.push({ path: "proposedStartAt", message: "The live must start in the future." });
  else if (startAt.getTime() > Date.now() + maximumDaysAheadForLiveInvitation * 86_400_000) issues.push({ path: "proposedStartAt", message: `Schedule the live within the next ${maximumDaysAheadForLiveInvitation} days.` });
  const basisPoints = body.commissionBasisPoints ?? null;
  if (basisPoints !== null && !isValidAffiliateCommissionBasisPoints(basisPoints)) issues.push({ path: "commissionBasisPoints", message: "Commission must be between 0% and 50%, or empty for your default." });
  if (typeof body.message !== "string" || body.message.trim().length > 500) issues.push({ path: "message", message: "Keep the message under 500 characters." });
  return issues;
}

export function registerAffiliateLiveInvitationMockHandlers(): void {
  registerMockRoute("GET", "/seller/affiliates/creator-directory", (request) => {
    requireMockStorePrincipal(request);
    const niche = request.query.get("niche");
    const state = readAffiliatesMockState();
    const creators = state.directory
      .filter((creator) => matchesSearchText(request.query.get("q"), creator.username, creator.name) && (!niche || creator.niche.toLowerCase() === niche.toLowerCase()))
      .map((creator) => ({ ...creator, isInYourProgram: state.approvedCreators.has(creator.id) }));
    return respondWithJson(200, paginateMockList(creators, request.query));
  });

  registerMockRoute("GET", "/seller/affiliates/live-invitations", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    const invitations = readAffiliatesMockState().liveInvitations.filter((invitation) => !status || invitation.status === status);
    return respondWithJson(200, paginateMockList(invitations, request.query));
  });

  registerMockRoute("POST", "/seller/affiliates/live-invitations", (request) => {
    requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateLiveInvitationBody(body);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const state = readAffiliatesMockState();
    if (!state.settings.enabled) throw new MockHttpError(409, "AFFILIATE_PROGRAM_OFF", "Turn on your affiliate program before inviting creators.");
    const creator = state.directory.find((candidate) => candidate.id === body.creatorId);
    if (!creator) throw new MockHttpError(404, "CREATOR_NOT_FOUND", "That creator is not in the Creator Program.");
    const productIds = [...new Set(body.productIds as string[])];
    const products = productIds.map((productId) => readMockDatabase().products.find((product) => product.id === productId && product.status === "active"));
    if (products.some((product) => !product)) return respondWithValidationFailure([{ path: "productIds", message: "One of the products is not available." }]);
    const invitation: LiveInvitation = {
      id: createMockIdentifier("liv"),
      creator,
      products: products.flatMap((product) => (product ? [{ id: product.id, name: product.name, imageUrl: product.images[0]?.url ?? null }] : [])),
      proposedStartAt: new Date(String(body.proposedStartAt)).toISOString(),
      commissionBasisPoints: (body.commissionBasisPoints ?? null) as number | null,
      message: String(body.message).trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    state.liveInvitations.unshift(invitation);
    recordAffiliateAuditEntry(request, "affiliates.live_invited", `Invited @${creator.username} to live-sell ${invitation.products.length} product${invitation.products.length === 1 ? "" : "s"}`, invitation.id);
    return respondWithJson(201, invitation);
  });

  registerMockRoute("POST", "/seller/affiliates/live-invitations/:invitationId/cancel", (request) => {
    requireMockStorePrincipal(request);
    const state = readAffiliatesMockState();
    const invitationIndex = state.liveInvitations.findIndex((invitation) => invitation.id === request.params.invitationId);
    const invitation = state.liveInvitations[invitationIndex];
    if (!invitation) throw new MockHttpError(404, "INVITATION_NOT_FOUND", "That invitation no longer exists.");
    if (invitation.status !== "pending" && invitation.status !== "accepted") throw new MockHttpError(409, "INVITATION_NOT_CANCELLABLE", "Only upcoming invitations can be cancelled.");
    const cancelledInvitation: LiveInvitation = { ...invitation, status: "cancelled" };
    state.liveInvitations[invitationIndex] = cancelledInvitation;
    recordAffiliateAuditEntry(request, "affiliates.live_cancelled", `Cancelled the live invitation for @${invitation.creator.username}`, invitation.id);
    return respondWithJson(200, cancelledInvitation);
  });
}
