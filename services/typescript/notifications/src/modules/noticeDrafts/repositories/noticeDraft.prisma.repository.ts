import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { NoticeDraftRepository } from "../../../interfaces/campaignRepository.interface.js";
import type { NoticeDraft } from "../../../types/campaign.type.js";

type Row = Awaited<ReturnType<PrismaClient["noticeDraft"]["findFirstOrThrow"]>>;

const convertRow = (row: Row): NoticeDraft => ({ ...row, whatChanged: row.whatChanged as string[], testSends: row.testSends as unknown as NoticeDraft["testSends"] });

export class NoticeDraftPrismaRepository implements NoticeDraftRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async find(versionId: string): Promise<NoticeDraft | null> {
    const row = await this.prisma.noticeDraft.findUnique({ where: { versionId } });
    return row === null ? null : convertRow(row);
  }

  public async createIfAbsent(draft: Parameters<NoticeDraftRepository["createIfAbsent"]>[0]): Promise<NoticeDraft> {
    const existing = await this.find(draft.versionId);
    if (existing !== null) return existing;
    return convertRow(await this.prisma.noticeDraft.create({ data: { ...draft, whatChanged: [...draft.whatChanged] } }));
  }

  public async update(versionId: string, changes: Parameters<NoticeDraftRepository["update"]>[1]): Promise<NoticeDraft | null> {
    if ((await this.find(versionId)) === null) return null;
    return convertRow(await this.prisma.noticeDraft.update({ where: { versionId }, data: { ...changes, whatChanged: [...changes.whatChanged] } }));
  }

  public async refreshVersionFacts(versionId: string, facts: Parameters<NoticeDraftRepository["refreshVersionFacts"]>[1]): Promise<NoticeDraft | null> {
    if ((await this.find(versionId)) === null) return null;
    return convertRow(await this.prisma.noticeDraft.update({ where: { versionId }, data: facts }));
  }

  public async appendTestSend(versionId: string, testSend: Parameters<NoticeDraftRepository["appendTestSend"]>[1]): Promise<NoticeDraft | null> {
    const existing = await this.find(versionId);
    if (existing === null) return null;
    return convertRow(await this.prisma.noticeDraft.update({ where: { versionId }, data: { testSends: [testSend, ...existing.testSends].slice(0, 10) } }));
  }
}
