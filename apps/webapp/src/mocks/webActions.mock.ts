import { ApiError } from "@/errors/api.error";

import { appendMockMessageAndUpdateConversation, mockConversations } from "./chats.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const shareableKinds = new Set(["post", "clip", "story", "product", "live", "store", "profile"]);
const verifiedEmailUserIds = new Set<string>(["u_me"]);
const sentVerificationCodeUserIds = new Set<string>();
const shareCountsByReference = new Map<string, number>();

export const isMockEmailVerifiedForUser = (userId: string) => verifiedEmailUserIds.has(userId);

interface ChatShareBody {
  readonly conversationIds?: unknown;
  readonly reference?: { readonly kind?: unknown; readonly id?: unknown };
  readonly note?: unknown;
}

function shareReferenceIntoConversations(body: ChatShareBody) {
  const conversationIds = Array.isArray(body.conversationIds) ? body.conversationIds.filter((id): id is string => typeof id === "string") : [];
  const kind = typeof body.reference?.kind === "string" ? body.reference.kind : "";
  const referenceId = typeof body.reference?.id === "string" ? body.reference.id : "";
  if (conversationIds.length === 0 || conversationIds.length > 20) throw new ApiError(422, "Choose between 1 and 20 chats");
  if (!shareableKinds.has(kind) || !referenceId) throw new ApiError(422, "This can't be shared");
  if (typeof body.note === "string" && body.note !== "") throw new ApiError(400, "Notes can't be sent with a share.", "VALIDATION_FAILED");
  const sharedLink = `https://zudomart.com/${kind}/${referenceId}`;
  let sentCount = 0;
  for (const conversationId of conversationIds) {
    if (!mockConversations.some((conversation) => conversation.id === conversationId)) continue;
    appendMockMessageAndUpdateConversation({
      id: `m_share_${Date.now()}_${sentCount}`,
      conversationId,
      senderId: getSignedInMockUser().id,
      text: sharedLink,
      createdAt: new Date().toISOString(),
      kind: "text",
    });
    sentCount += 1;
  }
  const referenceKey = `${kind}:${referenceId}`;
  const shareCount = (shareCountsByReference.get(referenceKey) ?? 0) + sentCount;
  shareCountsByReference.set(referenceKey, shareCount);
  return { sentCount, shareCount };
}

export const webActionsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/chat/shares", ({ body }) => shareReferenceIntoConversations((body ?? {}) as ChatShareBody)),
  createMockRoute("GET", "/api/v1/users/me/email", () => {
    const viewer = getSignedInMockUser();
    return { email: viewer.email ?? null, emailVerified: isMockEmailVerifiedForUser(viewer.id) };
  }),
  createMockRoute("POST", "/api/v1/users/me/email/verification", () => {
    const viewer = getSignedInMockUser();
    if (!viewer.email) throw new ApiError(422, "Add an email to your account first", "EMAIL_MISSING");
    if (isMockEmailVerifiedForUser(viewer.id)) throw new ApiError(409, "Your email is already verified", "ALREADY_VERIFIED");
    sentVerificationCodeUserIds.add(viewer.id);
    return { expiresIn: 600, resendAfterSeconds: 60 };
  }),
  createMockRoute("POST", "/api/v1/users/me/email/verification/confirm", ({ body }) => {
    const viewer = getSignedInMockUser();
    const code = String((body as { code?: unknown })?.code ?? "");
    if (!sentVerificationCodeUserIds.has(viewer.id)) throw new ApiError(409, "Send a code first", "CODE_NOT_SENT");
    if (!/^\d{6}$/.test(code)) throw new ApiError(422, "Enter the 6-digit code");
    if (code === "000000") throw new ApiError(400, "That code is incorrect. Check it and try again.", "INVALID_CODE");
    verifiedEmailUserIds.add(viewer.id);
    sentVerificationCodeUserIds.delete(viewer.id);
    return { email: viewer.email ?? null, emailVerified: true };
  }),
];
