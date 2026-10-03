import type { ConsentType } from "../../../types/searchDocument.type.js";
import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import type { SearchIndexStore } from "../../../interfaces/searchStore.interface.js";
import type { DocumentReindexer } from "./documentReindexer.service.js";
import { readEventVersion, readOptionalString, readRequiredString } from "./eventPayloadReader.service.js";

export type SearchEventHandler = (envelope: DomainEventEnvelope) => Promise<void>;

const consentTypes: readonly ConsentType[] = ["analytics", "personalization", "advertising", "marketing"];

export function createSearchEventHandlers(store: SearchIndexStore, reindexer: DocumentReindexer, nowMilliseconds: () => number): Readonly<Record<string, SearchEventHandler>> {
  const version = (envelope: DomainEventEnvelope) => readEventVersion(envelope, nowMilliseconds());
  const reindexAccount: SearchEventHandler = (envelope) => reindexer.reindexUser(readRequiredString(envelope, "accountId"), version(envelope));
  const reindexProduct: SearchEventHandler = (envelope) => reindexer.reindexProduct(readRequiredString(envelope, "productId"), version(envelope));
  const reindexStore: SearchEventHandler = (envelope) => reindexer.reindexStore(readRequiredString(envelope, "storeId"), version(envelope));
  const setConsent = (granted: boolean): SearchEventHandler => async (envelope) => {
    const consentType = readRequiredString(envelope, "consentType") as ConsentType;
    if (consentTypes.includes(consentType)) await store.setConsent(readRequiredString(envelope, "accountId"), consentType, granted);
  };
  return {
    "profile.updated": reindexAccount,
    "username.changed": reindexAccount,
    "creatorProfile.created": reindexAccount,
    "profileCheckmark.changed": reindexAccount,
    "checkmark.approved": reindexAccount,
    "checkmark.revoked": reindexAccount,
    "accountStatus.changed": reindexAccount,
    "account.suspended": reindexAccount,
    "account.banned": reindexAccount,
    "user.unbanned": reindexAccount,
    "suspension.ended": reindexAccount,
    "account.deactivated": reindexAccount,
    "account.deletionExecuted": reindexAccount,
    "profile.visibilityChanged": async (envelope) => {
      const accountId = readRequiredString(envelope, "accountId");
      await store.patchAccountState(accountId, { isPrivate: envelope.data["isPrivate"] === true }, version(envelope));
    },
    "product.created": reindexProduct,
    "product.updated": reindexProduct,
    "product.published": reindexProduct,
    "product.unpublished": reindexProduct,
    "product.archived": reindexProduct,
    "store.created": reindexStore,
    "store.updated": reindexStore,
    "brand.updated": (envelope) => reindexer.reindexBrand(readRequiredString(envelope, "brandId"), version(envelope)),
    "category.updated": (envelope) => reindexer.reindexCategory(readRequiredString(envelope, "categoryId"), version(envelope)),
    "sound.updated": (envelope) => reindexer.reindexSound(readRequiredString(envelope, "soundId"), version(envelope)),
    "post.created": (envelope) => reindexer.reindexPost(readRequiredString(envelope, "postId"), version(envelope)),
    "post.deleted": (envelope) => {
      const kind = readOptionalString(envelope, "kind");
      const kinds = kind === "post" || kind === "clip" ? [kind] as const : (["post", "clip"] as const);
      return reindexer.removePost(readRequiredString(envelope, "postId"), version(envelope), kinds);
    },
    "block.created": (envelope) => store.addBlock(readRequiredString(envelope, "blockerId"), readRequiredString(envelope, "blockedId")),
    "block.removed": (envelope) => store.removeBlock(readRequiredString(envelope, "blockerId"), readRequiredString(envelope, "blockedId")),
    "follow.created": (envelope) => store.addFollow(readRequiredString(envelope, "followerId"), readRequiredString(envelope, "followeeId")),
    "follow.removed": (envelope) => store.removeFollow(readRequiredString(envelope, "followerId"), readRequiredString(envelope, "followeeId")),
    "consent.granted": setConsent(true),
    "consent.withdrawn": setConsent(false),
  };
}
