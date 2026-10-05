import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { assertLocationSlotAvailable, describeMockActor } from "@/mocks/handlers/settingsEntitlements.mock";
import { normaliseStoreSettingsPatch, validateStoreSettingsPatch } from "@/mocks/handlers/settingsPatchValidation.mock";
import { registerStaffTeamMockHandlers } from "@/mocks/handlers/staffTeam.mock";
import { assertStorePlanIncludesFeature } from "@/mocks/handlers/workspaceDeveloperRoutes.mock";
import { createMockIdentifier, MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { StoreLocation } from "@/types/store.type";
import { fieldChecks, validateObjectAgainstChecks, type FieldCheck } from "@/utils/formValidation.util";

function buildLocationChecks(isPartial: boolean): Record<string, FieldCheck> {
  const wrap = (check: FieldCheck) => (isPartial ? fieldChecks.optional(check) : check);
  return {
    name: wrap(fieldChecks.text({ label: "Location name", min: 2, max: 60 })),
    kind: wrap(fieldChecks.oneOf("Location type", ["store", "warehouse"] as const)),
    address: wrap(fieldChecks.text({ label: "Address", min: 5, max: 200 })),
    city: wrap(fieldChecks.text({ label: "City", min: 2, max: 60 })),
    state: wrap(fieldChecks.text({ label: "State or region", min: 2, max: 60 })),
    phone: fieldChecks.optional(fieldChecks.phone()),
  };
}

function recordSettingsAudit(request: MockRequest, action: string, targetType: string, targetId: string | null, summary: string): void {
  appendMockAuditLogEntry({ actor: describeMockActor(requireMockStorePrincipal(request)), action, targetType, targetId, summary });
}

function readOptionalTrimmedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function registerStoreSettingsHandlers(): void {
  registerMockRoute("GET", "/seller/settings", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readMockDatabase().settings);
  });

  registerMockRoute("PATCH", "/seller/settings", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const body = readJsonObjectBody(request);
    const issues = validateStoreSettingsPatch(body, database.settings, new Set(database.categories.map((category) => category.id)));
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const patch = normaliseStoreSettingsPatch(body);
    const automatedAlertKeys = ["lowStockEmail", "lowStockSms", "dailySummaryEmail", "weeklyPerformanceEmail"] as const;
    if (patch.notifications && automatedAlertKeys.some((key) => patch.notifications?.[key] && !database.settings.notifications[key])) {
      assertStorePlanIncludesFeature(requireMockStorePrincipal(request).storeId, "automated_alerts", "Automated alerts");
    }
    database.settings = { ...database.settings, ...patch };
    recordSettingsAudit(request, "settings.updated", "store", database.settings.storeId, `Updated store settings: ${Object.keys(patch).join(", ")}`);
    return respondWithJson(200, database.settings);
  });

  registerMockRoute("PUT", "/seller/marketing/rewards/settings", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const body = { storeRewards: readJsonObjectBody(request) };
    const issues = validateStoreSettingsPatch(body, database.settings, new Set(database.categories.map((category) => category.id)));
    if (issues.length > 0) return respondWithValidationFailure(issues);
    database.settings = { ...database.settings, ...normaliseStoreSettingsPatch(body) };
    return respondWithJson(200, database.settings.storeRewards);
  });
}

function registerLocationHandlers(): void {
  registerMockRoute("GET", "/seller/locations", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: readMockDatabase().locations, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/locations", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, buildLocationChecks(false));
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const database = readMockDatabase();
    if (database.locations.some((location) => location.name.toLowerCase() === String(body.name).trim().toLowerCase())) throw new MockHttpError(409, "LOCATION_EXISTS", "You already have a location with that name.");
    assertLocationSlotAvailable(principal.storeId);
    const location: StoreLocation = {
      id: createMockIdentifier("loc"),
      name: String(body.name).trim(),
      kind: body.kind as StoreLocation["kind"],
      address: String(body.address).trim(),
      city: String(body.city).trim(),
      state: String(body.state).trim(),
      country: database.settings.country,
      phone: readOptionalTrimmedText(body.phone),
      isDefault: false,
      active: true,
    };
    database.locations.push(location);
    for (const product of database.products) for (const variant of product.variants) (variant.stock as { locationId: string; onHand: number; reserved: number }[]).push({ locationId: location.id, onHand: 0, reserved: 0 });
    recordSettingsAudit(request, "location.created", "location", location.id, `Added location ${location.name}`);
    return respondWithJson(201, location);
  });

  registerMockRoute("PATCH", "/seller/locations/:locationId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const locationIndex = database.locations.findIndex((location) => location.id === request.params.locationId);
    const current = database.locations[locationIndex];
    if (!current) throw new MockHttpError(404, "LOCATION_NOT_FOUND", "That location no longer exists.");
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, { ...buildLocationChecks(true), active: fieldChecks.optional(fieldChecks.boolean("Active")), isDefault: fieldChecks.optional(fieldChecks.boolean("Default")) });
    if (issues.length > 0) return respondWithValidationFailure(issues);
    if (body.active === false && current.isDefault) throw new MockHttpError(409, "DEFAULT_LOCATION", "Make another location the default before deactivating this one.");
    if (body.active === true && !current.active) assertLocationSlotAvailable(principal.storeId);
    if (body.isDefault === true && body.active === false) throw new MockHttpError(409, "DEFAULT_LOCATION", "The default location must stay active.");
    const updated: StoreLocation = {
      ...current,
      name: typeof body.name === "string" ? body.name.trim() : current.name,
      kind: (body.kind as StoreLocation["kind"] | undefined) ?? current.kind,
      address: typeof body.address === "string" ? body.address.trim() : current.address,
      city: typeof body.city === "string" ? body.city.trim() : current.city,
      state: typeof body.state === "string" ? body.state.trim() : current.state,
      phone: body.phone === undefined ? current.phone : readOptionalTrimmedText(body.phone),
      active: typeof body.active === "boolean" ? body.active : current.active,
      isDefault: body.isDefault === true ? true : current.isDefault,
    };
    if (body.isDefault === true && !current.active && body.active !== true) throw new MockHttpError(409, "DEFAULT_LOCATION", "Activate this location before making it the default.");
    database.locations = database.locations.map((location) => (location.id === updated.id ? updated : body.isDefault === true ? { ...location, isDefault: false } : location));
    recordSettingsAudit(request, "location.updated", "location", updated.id, `Updated location ${updated.name}`);
    return respondWithJson(200, updated);
  });
}

export function registerTeamAndSettingsMockHandlers(): void {
  registerStoreSettingsHandlers();
  registerLocationHandlers();
  registerStaffTeamMockHandlers();
}
