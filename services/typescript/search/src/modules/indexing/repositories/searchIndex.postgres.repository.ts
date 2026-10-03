import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { SearchIndexStore, UpsertOutcome } from "../../../interfaces/searchStore.interface.js";
import type { SearchDocument } from "../../../types/searchDocument.type.js";
import { countPublicHashtagPosts, upsertDocumentRow } from "../../../repositories/searchQueries.repository.js";
import { buildNormalizedTitle } from "../services/normalizedTitle.service.js";

export function createSearchIndexPostgresRepository(prisma: PrismaClient): SearchIndexStore {
  return {
    async upsertDocument(document: SearchDocument): Promise<UpsertOutcome> {
      const result = await upsertDocumentRow(prisma, document, buildNormalizedTitle(document));
      return { applied: result.written > 0, previousTags: result.previousTags };
    },
    async tombstoneDocument(kind, entityId, version) {
      const existing = await prisma.searchDocument.findUnique({ where: { kind_entityId: { kind, entityId } }, select: { tags: true } });
      const result = await prisma.searchDocument.updateMany({ where: { kind, entityId, version: { lte: BigInt(version) } }, data: { available: false, visibility: "hidden", deletedAt: new Date(), version: BigInt(version) } });
      return result.count > 0 ? (existing?.tags ?? []) : [];
    },
    async refreshHashtag(tag, version) {
      const total = await countPublicHashtagPosts(prisma, tag);
      const summary = { id: tag, tag, postCount: total };
      const base = { title: `#${tag}`, summary, available: total > 0, popularity: total };
      await prisma.searchDocument.upsert({
        where: { kind_entityId: { kind: "hashtag", entityId: tag } },
        create: { ...base, kind: "hashtag", entityId: tag, docKey: `hashtag:${tag}`, titleNormalized: tag, visibility: "public", version: BigInt(version), createdAt: new Date() },
        update: base,
      });
    },
    async patchAccountState(accountId, patch, version) {
      const next = BigInt(version);
      const existing = await prisma.accountState.findUnique({ where: { accountId } });
      if (existing !== null && existing.version > next) return;
      await prisma.accountState.upsert({
        where: { accountId },
        create: { accountId, status: patch.status ?? "active", isPrivate: patch.isPrivate ?? false, version: next },
        update: { ...(patch.status === undefined ? {} : { status: patch.status }), ...(patch.isPrivate === undefined ? {} : { isPrivate: patch.isPrivate }), version: next },
      });
    },
    async addBlock(blockerId, blockedId) {
      await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} });
    },
    async removeBlock(blockerId, blockedId) {
      await prisma.block.deleteMany({ where: { blockerId, blockedId } });
    },
    async addFollow(followerId, followeeId) {
      await prisma.follow.upsert({ where: { followerId_followeeId: { followerId, followeeId } }, create: { followerId, followeeId }, update: {} });
    },
    async removeFollow(followerId, followeeId) {
      await prisma.follow.deleteMany({ where: { followerId, followeeId } });
    },
    async setConsent(accountId, consentType, granted) {
      await prisma.consent.upsert({ where: { accountId_consentType: { accountId, consentType } }, create: { accountId, consentType, granted }, update: { granted } });
    },
    async hasConsent(accountId, consentType) {
      return (await prisma.consent.findUnique({ where: { accountId_consentType: { accountId, consentType } } }))?.granted === true;
    },
    async claimEvent(eventId) {
      const result = await prisma.processedEvent.createMany({ data: [{ eventId }], skipDuplicates: true });
      return result.count === 1;
    },
    async releaseEvent(eventId) {
      await prisma.processedEvent.deleteMany({ where: { eventId } });
    },
  };
}
