import { kindRankingBonus, trigramSimilarityThreshold } from "../constants/search.constant.js";
import type { PrismaClient } from "../databases/prisma.database.js";
import { Prisma } from "../generated/prisma/client.js";
import type { SearchDocument, SearchKind } from "../types/searchDocument.type.js";
import type { SearchCursor } from "../types/searchResult.type.js";

export interface SearchRow {
  readonly kind: SearchKind;
  readonly entity_id: string;
  readonly summary: Record<string, unknown>;
  readonly popularity: number;
  readonly created_at: Date;
  readonly owner_account_id: string | null;
  readonly score: number;
}

export interface SearchRowsInput {
  readonly needle: string;
  readonly tsQuery: string;
  readonly kinds: readonly SearchKind[];
  readonly viewerId: string | null;
  readonly region: string | null;
  readonly likePattern: string;
  readonly cursor: SearchCursor | undefined;
  readonly limit: number;
}

export async function upsertDocumentRow(prisma: PrismaClient, document: SearchDocument, titleNormalized: string): Promise<{ written: number; previousTags: string[] }> {
  const tagsText = document.tags.join(" ");
  const docKey = `${document.kind}:${document.entityId}`;
  const rows = await prisma.$queryRaw<{ written: number; previous_tags: string[] }[]>(Prisma.sql`
    with previous as (select tags from documents where kind = ${document.kind} and entity_id = ${document.entityId}),
    written as (
      insert into documents (kind, entity_id, doc_key, owner_account_id, title, title_normalized, subtitle, body, tags_text, tags, summary, visibility, available, popularity, region, version, deleted_at, created_at, updated_at, tsv)
      values (${document.kind}, ${document.entityId}, ${docKey}, ${document.ownerAccountId}, ${document.title}, ${titleNormalized}, ${document.subtitle}, ${document.body}, ${tagsText}, ${[...document.tags]}::text[],
        ${JSON.stringify(document.summary)}::jsonb, ${document.visibility}, ${document.available}, ${document.popularity}::float8, ${document.region}, ${BigInt(document.version)}::bigint, null, ${new Date(document.createdAt)}::timestamp, now(),
        setweight(to_tsvector('simple', ${document.title}::text), 'A') || setweight(to_tsvector('simple', ${tagsText}::text), 'B') || setweight(to_tsvector('simple', coalesce(${document.subtitle}::text, '')), 'B') || setweight(to_tsvector('simple', ${document.body}::text), 'C'))
      on conflict (kind, entity_id) do update set
        owner_account_id = excluded.owner_account_id, title = excluded.title, title_normalized = excluded.title_normalized, subtitle = excluded.subtitle,
        body = excluded.body, tags_text = excluded.tags_text, tags = excluded.tags, summary = excluded.summary, visibility = excluded.visibility,
        available = excluded.available, popularity = excluded.popularity, region = excluded.region, version = excluded.version, deleted_at = null, updated_at = now(), tsv = excluded.tsv
      where documents.version <= excluded.version
      returning 1
    )
    select (select count(*) from written)::int as written, coalesce((select tags from previous), '{}') as previous_tags`);
  const row = rows[0] as { written: number; previous_tags: string[] };
  return { written: row.written, previousTags: row.previous_tags };
}

export async function countPublicHashtagPosts(prisma: PrismaClient, tag: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
    select count(*)::int as total from documents d
    left join account_states s on s.account_id = d.owner_account_id
    where d.kind in ('post', 'clip') and d.available and d.visibility = 'public' and ${tag} = any(d.tags)
      and (s.account_id is null or (s.status = 'active' and not s.is_private))`);
  return rows[0]?.total ?? 0;
}

function visibilityFilter(viewerId: string | null): Prisma.Sql {
  return Prisma.sql`
    d.available and d.visibility <> 'hidden'
    and (s.account_id is null or s.status = 'active')
    and (d.owner_account_id is null or ${viewerId}::text is null or d.owner_account_id = ${viewerId}::text or not exists (
      select 1 from blocks b where (b.blocker_id = ${viewerId}::text and b.blocked_id = d.owner_account_id) or (b.blocker_id = d.owner_account_id and b.blocked_id = ${viewerId}::text)))
    and (d.kind not in ('user', 'post', 'clip') or d.owner_account_id is null or d.owner_account_id = ${viewerId}::text or s.account_id is null or not s.is_private
      or exists (select 1 from follows f where f.follower_id = ${viewerId}::text and f.followee_id = d.owner_account_id))
    and (d.visibility = 'public' or d.owner_account_id = ${viewerId}::text
      or (d.visibility = 'followers' and exists (select 1 from follows f where f.follower_id = ${viewerId}::text and f.followee_id = d.owner_account_id)))`;
}

function scoreExpression(input: SearchRowsInput): Prisma.Sql {
  const bonuses = Prisma.join(Object.entries(kindRankingBonus).map(([kind, bonus]) => Prisma.sql`when ${kind} then ${bonus}::float8`), " ");
  return Prisma.sql`
    case when d.title_normalized = ${input.needle} then 3.0 else 0 end
    + case when d.title_normalized like ${input.likePattern} then 1.5 else 0 end
    + 2.0 * similarity(d.title_normalized, ${input.needle})
    + 1.5 * ts_rank_cd(d.tsv, query.tsq)
    + 0.4 * least(1.0, ln(1 + d.popularity) / 12.0)
    + case when ${input.region}::text is not null and d.region = ${input.region}::text then 0.3 else 0 end
    + case d.kind ${bonuses} else 0 end`;
}

export function searchRows(prisma: PrismaClient, input: SearchRowsInput): Promise<SearchRow[]> {
  const cursorScore = input.cursor?.score ?? null;
  const cursorKey = input.cursor?.key ?? null;
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`select set_config('pg_trgm.similarity_threshold', ${String(trigramSimilarityThreshold)}, true)`);
    return transaction.$queryRaw<SearchRow[]>(Prisma.sql`
      select * from (
        select d.kind, d.entity_id, d.doc_key, d.summary, d.popularity, d.created_at, d.owner_account_id, round((${scoreExpression(input)})::numeric, 6)::float8 as score
        from documents d
        cross join (select to_tsquery('simple', ${input.tsQuery}) as tsq) query
        left join account_states s on s.account_id = d.owner_account_id
        where d.kind = any(${[...input.kinds]}::text[])
          and (d.tsv @@ query.tsq or d.title_normalized % ${input.needle} or d.title_normalized like ${input.likePattern})
          and ${visibilityFilter(input.viewerId)}
      ) ranked
      where ${cursorScore}::float8 is null or score < ${cursorScore}::float8 or (score = ${cursorScore}::float8 and doc_key > ${cursorKey}::text)
      order by score desc, doc_key asc
      limit ${input.limit}`);
  });
}
