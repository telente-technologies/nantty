export function adaptListEnvelope<Payload>(payload: Payload): Payload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.data) || "items" in record) return payload;
  const total = typeof record.total === "number" ? record.total : record.data.length;
  const page = typeof record.page === "number" ? record.page : 1;
  const pageSize = typeof record.pageSize === "number" ? record.pageSize : Math.max(record.data.length, 1);
  return { ...record, items: record.data, page, pageSize, total, nextCursor: record.nextCursor ?? null } as Payload;
}

export function toServerListEnvelope(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  const { items, ...rest } = body as Record<string, unknown>;
  if (!Array.isArray(items) || !("nextCursor" in rest || ("page" in rest && "pageSize" in rest))) return body;
  return { data: items, ...rest };
}
