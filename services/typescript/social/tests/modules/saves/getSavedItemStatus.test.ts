import { describe, expect, it, vi } from "vitest";
import type { HandlerContext } from "../../../src/types/handlerContext.type.js";
import { createGetSavedItemStatusHandler } from "../../../src/modules/saves/queries/getSavedItemStatus/getSavedItemStatus.handler.js";

describe("get saved item status", () => {
  it("checks the unique user, type, and target tuple", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "saved-item" });
    const context = { database: { client: { savedItem: { findUnique } } } } as unknown as HandlerContext;

    await expect(createGetSavedItemStatusHandler(context)({ userId: "user-1", type: "product", targetId: "product-1" }))
      .resolves.toEqual({ isSaved: true });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_type_targetId: { userId: "user-1", type: "product", targetId: "product-1" } },
      select: { id: true },
    });
  });

  it("returns false when that exact item has not been saved", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const context = { database: { client: { savedItem: { findUnique } } } } as unknown as HandlerContext;

    await expect(createGetSavedItemStatusHandler(context)({ userId: "user-1", type: "product", targetId: "product-2" }))
      .resolves.toEqual({ isSaved: false });
  });
});
