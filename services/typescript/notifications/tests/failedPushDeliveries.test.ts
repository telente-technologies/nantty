import type { HttpRequestContext } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../src/databases/prisma.database.js";
import type { Container } from "../src/container.js";
import { StaffAuthenticator, type StaffPrincipal } from "../src/middlewares/staffAuth.middleware.js";
import { createBulkCampaignRoutes } from "../src/modules/bulkCampaigns/routes/bulkCampaigns.routes.js";
import { DeliveryPrismaRepository } from "../src/modules/delivery/repositories/delivery.prisma.repository.js";
import { sanitizePushFailureReason } from "../src/utils/pushFailure.util.js";

describe("failed push delivery observability", () => {
  it("uses a bounded query that never selects recipient or token fields", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: "delivery-1", eventId: "evt-1", templateKey: null, attemptCount: 1,
      failedAt: new Date("2026-11-05T12:00:00.000Z"), skipReason: "expo_push_failure:accepted=0;permanent:DeviceNotRegistered:1",
    }]);
    const repository = new DeliveryPrismaRepository({ delivery: { findMany } } as unknown as PrismaClient);

    const rows = await repository.listFailedPushes(1000);

    expect(findMany).toHaveBeenCalledWith({
      where: { channel: "push", status: "failed" },
      orderBy: { failedAt: "desc" },
      take: 100,
      select: { id: true, eventId: true, templateKey: true, attemptCount: true, failedAt: true, skipReason: true },
    });
    expect(rows[0]).toMatchObject({ id: "delivery-1", reason: expect.stringContaining("DeviceNotRegistered") });
    expect(JSON.stringify(rows)).not.toContain("userId");
    expect(JSON.stringify(rows)).not.toContain("token");
  });

  it("requires the existing support staff permission and returns only safe delivery metadata", async () => {
    const row = { id: "delivery-1", eventId: "evt-1", templateKey: null, attemptCount: 2, failedAt: null, reason: "push_transport_error:retryable" };
    const staff: StaffPrincipal = { id: "staff-1", name: "Support", role: "support", permissions: ["support:email"], steppedUp: false };
    const container = {
      staffAuthenticator: { authenticate: vi.fn(async (_request: HttpRequestContext) => staff) } as unknown as StaffAuthenticator,
      listFailedPushDeliveries: { execute: vi.fn(async () => [row]) },
    } as unknown as Container;
    const context = { request: {} as HttpRequestContext, params: {} };
    const route = createBulkCampaignRoutes(container).find((entry) => entry.path === "/api/v1/admin/support/notifications/push/deliveries/failed");
    expect(route).toBeDefined();

    const response = await route!.handler(context);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deliveries: [row] });
    expect(JSON.stringify(response.body)).not.toContain("userId");
    expect(JSON.stringify(response.body)).not.toContain("deviceToken");

    const deniedContainer = {
      staffAuthenticator: { authenticate: vi.fn(async () => ({ ...staff, permissions: ["marketing:email"] })) } as unknown as StaffAuthenticator,
      listFailedPushDeliveries: { execute: vi.fn() },
    } as unknown as Container;
    const deniedRoute = createBulkCampaignRoutes(deniedContainer).find((entry) => entry.path === "/api/v1/admin/support/notifications/push/deliveries/failed");
    await expect(deniedRoute!.handler(context)).rejects.toMatchObject({ status: 403 });
  });

  it("redacts legacy raw provider errors that may contain a device token", async () => {
    const repository = new DeliveryPrismaRepository({ delivery: { findMany: vi.fn().mockResolvedValue([{
      id: "delivery-legacy", eventId: "evt-legacy", templateKey: null, attemptCount: 1,
      failedAt: null, skipReason: "Expo rejected ExponentPushToken[secret-device-token]",
    }]) } } as unknown as PrismaClient);

    await expect(repository.listFailedPushes(10)).resolves.toMatchObject([{ reason: "legacy_provider_failure" }]);
  });

  it("does not treat a provider-supplied arbitrary code as safe metadata", () => {
    expect(sanitizePushFailureReason("expo_push_failure:accepted=0;permanent:ExponentPushToken_secret:1"))
      .toBe("legacy_provider_failure");
  });
});
