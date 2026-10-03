import { describe, expect, it } from "vitest";

import { paginateSavedRows, resolveSavedTypeFilter, resolveSavesLimit } from "../../src/modules/saves/services/savesPagination.service.js";

const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `id-${String(count - index).padStart(3, "0")}` }));

describe("saves pagination", () => {
  it("returns 12 per page and a cursor when more exist", () => {
    const page = paginateSavedRows(rows(13));
    expect(page.data).toHaveLength(12);
    expect(page.nextCursor).toBe(page.data.at(-1)?.id);
  });
  it("ends with a null cursor on the last page", () => {
    expect(paginateSavedRows(rows(12)).nextCursor).toBeNull();
    expect(paginateSavedRows(rows(3))).toMatchObject({ nextCursor: null, data: expect.any(Array) });
  });
  it("handles an empty list", () => {
    expect(paginateSavedRows([])).toEqual({ data: [], nextCursor: null });
  });
  it("maps the All filter to no filter", () => {
    expect(resolveSavedTypeFilter("all")).toBeUndefined();
    expect(resolveSavedTypeFilter(undefined)).toBeUndefined();
    expect(resolveSavedTypeFilter("clip")).toEqual(["clip"]);
  });
  it("caps the limit at the page size", () => {
    expect(resolveSavesLimit(50)).toBe(12);
    expect(resolveSavesLimit(5)).toBe(5);
    expect(resolveSavesLimit(undefined)).toBe(12);
  });
});
