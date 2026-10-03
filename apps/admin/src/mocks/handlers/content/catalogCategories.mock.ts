import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { failConflict, failNotFound, failValidation, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, readRequiredReason, readRequiredTrimmedString, respondWithJson, createMockId, readEnumValue } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { CatalogCategory } from "@/types/catalog.type";

import { convertTextToSlug, readCatalogMockStore } from "./contentStores.mock";

const auditTargetForCategory = (category: CatalogCategory) => ({ type: "category", id: category.id, label: category.name });

function findCategoryOrFail(categoryId: string | undefined): CatalogCategory {
  const category = readCatalogMockStore().categories.find((candidate) => candidate.id === categoryId);
  if (!category) failNotFound("Category");
  return category;
}

function replaceCategory(updated: CatalogCategory): void {
  const store = readCatalogMockStore();
  store.categories = store.categories.map((candidate) => (candidate.id === updated.id ? updated : candidate));
}

function readSlugOrDeriveFromName(body: Record<string, unknown>, name: string, excludedCategoryId: string | null): string {
  const typedSlug = readOptionalTrimmedString(body, "slug", 80);
  const slug = typedSlug ?? convertTextToSlug(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) failValidation("slug", "Use lowercase letters, numbers and single hyphens.");
  if (readCatalogMockStore().categories.some((category) => category.slug === slug && category.id !== excludedCategoryId)) failConflict("SLUG_TAKEN", "Another category already uses this slug.");
  return slug;
}

function readParentIdOrFail(body: Record<string, unknown>, movingCategoryId: string | null): string | null {
  const parentId = body.parentId;
  if (parentId === null || parentId === undefined || parentId === "") return null;
  if (typeof parentId !== "string") failValidation("parentId", "Choose a parent category.");
  const parent = findCategoryOrFail(parentId);
  if (parent.parentId !== null) failValidation("parentId", "Categories can only be two levels deep. Choose a top-level parent.");
  if (movingCategoryId && (parent.id === movingCategoryId)) failValidation("parentId", "A category cannot be its own parent.");
  if (movingCategoryId && readCatalogMockStore().categories.some((category) => category.parentId === movingCategoryId)) failValidation("parentId", "Move or remove this category's subcategories first.");
  return parent.id;
}

function readIconNameOrNull(body: Record<string, unknown>): string | null {
  const iconName = readOptionalTrimmedString(body, "iconName", 40);
  if (iconName && !/^[a-zA-Z0-9]+$/.test(iconName)) failValidation("iconName", "Icon names are camelCase letters and numbers.");
  return iconName;
}

function listSiblings(parentId: string | null): CatalogCategory[] {
  return readCatalogMockStore().categories.filter((category) => category.parentId === parentId).sort((first, second) => first.sortOrder - second.sortOrder);
}

function requireCatalogPermission(request: MockRequest) {
  return requireMockPermission(request, "catalog:manage");
}

export function registerCatalogCategoryMockHandlers(): void {
  registerMockRoute("GET", "/admin/catalog/categories", (request) => {
    requireCatalogPermission(request);
    return respondWithJson(200, { items: readCatalogMockStore().categories });
  });

  registerMockRoute("GET", "/admin/catalog/categories/:categoryId", (request) => {
    requireCatalogPermission(request);
    const category = findCategoryOrFail(request.params.categoryId);
    return respondWithJson(200, { item: category, history: listMockAuditEntriesForTarget("category", category.id) });
  });

  registerMockRoute("POST", "/admin/catalog/categories", (request) => {
    requireCatalogPermission(request);
    const body = readJsonObjectBody(request);
    const name = readRequiredTrimmedString(body, "name", 60, 2);
    const slug = readSlugOrDeriveFromName(body, name, null);
    const parentId = readParentIdOrFail(body, null);
    const reason = readRequiredReason(body);
    const category: CatalogCategory = { id: createMockId("cat"), parentId, name, slug, iconName: readIconNameOrNull(body), isActive: true, sortOrder: listSiblings(parentId).length, productCount: 0, updatedAt: readIsoNow() };
    readCatalogMockStore().categories.push(category);
    recordMockAuditEntry(request, { action: "catalog.category_created", area: "catalog", target: auditTargetForCategory(category), reason, before: null, after: category });
    return respondWithJson(201, { item: category });
  });

  registerMockRoute("PATCH", "/admin/catalog/categories/:categoryId", (request) => {
    requireCatalogPermission(request);
    const before = findCategoryOrFail(request.params.categoryId);
    const body = readJsonObjectBody(request);
    const name = body.name === undefined ? before.name : readRequiredTrimmedString(body, "name", 60, 2);
    const slug = body.slug === undefined ? before.slug : readSlugOrDeriveFromName(body, name, before.id);
    const parentId = body.parentId === undefined ? before.parentId : readParentIdOrFail(body, before.id);
    const iconName = body.iconName === undefined ? before.iconName : readIconNameOrNull(body);
    const reason = readRequiredReason(body);
    const sortOrder = parentId === before.parentId ? before.sortOrder : listSiblings(parentId).length;
    const updated: CatalogCategory = { ...before, name, slug, parentId, iconName, sortOrder, updatedAt: readIsoNow() };
    replaceCategory(updated);
    recordMockAuditEntry(request, { action: parentId === before.parentId ? "catalog.category_updated" : "catalog.category_moved", area: "catalog", target: auditTargetForCategory(updated), reason, before: { name: before.name, slug: before.slug, parentId: before.parentId, iconName: before.iconName }, after: { name, slug, parentId, iconName } });
    return respondWithJson(200, { item: updated });
  });

  registerMockRoute("POST", "/admin/catalog/categories/:categoryId/move", (request) => {
    requireCatalogPermission(request);
    const category = findCategoryOrFail(request.params.categoryId);
    const body = readJsonObjectBody(request);
    const direction = readEnumValue(body, "direction", ["up", "down"] as const);
    const siblings = listSiblings(category.parentId);
    const index = siblings.findIndex((sibling) => sibling.id === category.id);
    const neighbour = siblings[direction === "up" ? index - 1 : index + 1];
    if (!neighbour) failConflict("CANNOT_MOVE", `This category is already ${direction === "up" ? "first" : "last"}.`);
    replaceCategory({ ...category, sortOrder: neighbour.sortOrder, updatedAt: readIsoNow() });
    replaceCategory({ ...neighbour, sortOrder: category.sortOrder });
    recordMockAuditEntry(request, { action: "catalog.category_reordered", area: "catalog", target: auditTargetForCategory(category), before: { sortOrder: category.sortOrder }, after: { sortOrder: neighbour.sortOrder } });
    return respondWithJson(200, { items: readCatalogMockStore().categories });
  });

  for (const action of ["deactivate", "activate"] as const) {
    registerMockRoute("POST", `/admin/catalog/categories/:categoryId/${action}`, (request) => {
      requireCatalogPermission(request);
      const before = findCategoryOrFail(request.params.categoryId);
      const reason = readRequiredReason(readJsonObjectBody(request));
      const isActive = action === "activate";
      if (before.isActive === isActive) failConflict("NO_CHANGE", `This category is already ${isActive ? "active" : "inactive"}.`);
      const updated = { ...before, isActive, updatedAt: readIsoNow() };
      replaceCategory(updated);
      if (!isActive) readCatalogMockStore().categories.filter((child) => child.parentId === before.id).forEach((child) => replaceCategory({ ...child, isActive: false, updatedAt: readIsoNow() }));
      recordMockAuditEntry(request, { action: `catalog.category_${action}d`, area: "catalog", target: auditTargetForCategory(updated), reason, before: { isActive: before.isActive }, after: { isActive } });
      return respondWithJson(200, { item: updated });
    });
  }
}
