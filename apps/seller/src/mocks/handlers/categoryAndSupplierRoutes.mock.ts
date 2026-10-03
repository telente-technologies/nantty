import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { assertMockStorePlanIncludesFeature } from "@/mocks/handlers/catalogPlanRules.mock";
import { recordCatalogAuditEntry, replaceMockProduct } from "@/mocks/handlers/productCatalogStore.mock";
import { findMockSupplierOrThrow, listMockSuppliersWithProductCounts, readMockSupplierSlice } from "@/mocks/handlers/supplierStore.mock";
import type { ProductCategory, Supplier } from "@/types/catalog.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

function listCategoriesWithProductCounts(): ProductCategory[] {
  const database = readMockDatabase();
  return database.categories.map((category) => ({ ...category, description: category.description ?? "", productCount: database.products.filter((product) => product.categoryId === category.id && product.status !== "archived").length }));
}

function validateCategoryBody(body: Record<string, unknown>, excludedCategoryId: string | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 40) issues.push({ path: "name", message: "Category names need 2 to 40 characters." });
  else if (readMockDatabase().categories.some((category) => category.id !== excludedCategoryId && category.name.toLowerCase() === name.toLowerCase())) issues.push({ path: "name", message: "You already have a category with that name." });
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 300)) issues.push({ path: "description", message: "Descriptions must be 300 characters or fewer." });
  return issues;
}

function readSupplierFromBody(body: Record<string, unknown>, issues: ValidationIssue[]): Omit<Supplier, "id" | "productCount" | "createdAt"> {
  const text = (key: string) => (typeof body[key] === "string" ? String(body[key]).trim() : "");
  const name = text("name");
  const phone = text("phone");
  const email = text("email");
  const leadTimeDays = body.leadTimeDays;
  if (name.length < 2 || name.length > 80) issues.push({ path: "name", message: "Supplier name needs 2 to 80 characters." });
  if (text("contactName").length > 80) issues.push({ path: "contactName", message: "Contact name must be 80 characters or fewer." });
  if (!/^\+?[0-9 ]{7,20}$/.test(phone)) issues.push({ path: "phone", message: "Enter a phone number like +234 803 555 0142." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ path: "email", message: "Enter a valid email or leave it empty." });
  if (text("address").length > 200) issues.push({ path: "address", message: "Address must be 200 characters or fewer." });
  if (typeof leadTimeDays !== "number" || !Number.isInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 180) issues.push({ path: "leadTimeDays", message: "Lead time must be 0 to 180 days." });
  if (text("paymentTerms").length > 80) issues.push({ path: "paymentTerms", message: "Payment terms must be 80 characters or fewer." });
  if (text("notes").length > 500) issues.push({ path: "notes", message: "Notes must be 500 characters or fewer." });
  return { name, contactName: text("contactName"), phone, email: email || null, address: text("address"), leadTimeDays: typeof leadTimeDays === "number" ? leadTimeDays : 0, paymentTerms: text("paymentTerms"), notes: text("notes") || null };
}

function requireSupplierFeature(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  assertMockStorePlanIncludesFeature(principal.storeId, "advanced_inventory", "Supplier management");
  return principal;
}

function registerCategoryMockRoutes(): void {
  registerMockRoute("GET", "/seller/categories", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: listCategoriesWithProductCounts(), nextCursor: null });
  });

  registerMockRoute("POST", "/seller/categories", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateCategoryBody(body, null);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const database = readMockDatabase();
    if (database.categories.length >= 100) throw new MockHttpError(409, "CATEGORY_LIMIT_REACHED", "A store can have up to 100 categories.");
    const category: ProductCategory = { id: createMockIdentifier("cat"), name: String(body.name).trim(), description: typeof body.description === "string" ? body.description.trim() : "" };
    database.categories.push(category);
    recordCatalogAuditEntry(principal, "category.created", "category", category.id, `Created category ${category.name}`);
    return respondWithJson(201, { ...category, productCount: 0 });
  });

  registerMockRoute("PATCH", "/seller/categories/:categoryId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const categoryIndex = database.categories.findIndex((category) => category.id === request.params.categoryId);
    const current = database.categories[categoryIndex];
    if (!current) throw new MockHttpError(404, "CATEGORY_NOT_FOUND", "That category no longer exists.");
    const body = readJsonObjectBody(request);
    const issues = validateCategoryBody(body, current.id);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const updated: ProductCategory = { ...current, name: String(body.name).trim(), description: typeof body.description === "string" ? body.description.trim() : current.description ?? "" };
    database.categories[categoryIndex] = updated;
    for (const product of database.products.filter((candidate) => candidate.categoryId === updated.id)) replaceMockProduct({ ...product, categoryName: updated.name });
    recordCatalogAuditEntry(principal, "category.updated", "category", updated.id, `Renamed category to ${updated.name}`);
    return respondWithJson(200, listCategoriesWithProductCounts().find((category) => category.id === updated.id));
  });

  registerMockRoute("DELETE", "/seller/categories/:categoryId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const category = database.categories.find((candidate) => candidate.id === request.params.categoryId);
    if (!category) throw new MockHttpError(404, "CATEGORY_NOT_FOUND", "That category no longer exists.");
    if (database.settings.taxes.some((tax) => tax.appliesToCategoryIds?.includes(category.id))) throw new MockHttpError(409, "CATEGORY_IN_USE_BY_TAX", "A tax rate uses this category. Change the tax rate first.");
    database.categories = database.categories.filter((candidate) => candidate.id !== category.id);
    for (const product of database.products.filter((candidate) => candidate.categoryId === category.id)) replaceMockProduct({ ...product, categoryId: null, categoryName: null });
    recordCatalogAuditEntry(principal, "category.deleted", "category", category.id, `Deleted category ${category.name}`);
    return respondWithNoContent();
  });
}

function registerSupplierMockRoutes(): void {
  registerMockRoute("GET", "/seller/suppliers", (request) => {
    requireSupplierFeature(request);
    const suppliers = listMockSuppliersWithProductCounts().filter((supplier) => matchesSearchText(request.query.get("q"), supplier.name, supplier.contactName, supplier.phone));
    return respondWithJson(200, paginateMockList(suppliers, request.query, 50));
  });

  registerMockRoute("POST", "/seller/suppliers", (request) => {
    const principal = requireSupplierFeature(request);
    const issues: ValidationIssue[] = [];
    const fields = readSupplierFromBody(readJsonObjectBody(request), issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const supplier: Supplier = { ...fields, id: createMockIdentifier("sup"), productCount: 0, createdAt: new Date().toISOString() };
    readMockSupplierSlice().suppliers.unshift(supplier);
    recordCatalogAuditEntry(principal, "supplier.created", "supplier", supplier.id, `Added supplier ${supplier.name}`);
    return respondWithJson(201, supplier);
  });

  registerMockRoute("PATCH", "/seller/suppliers/:supplierId", (request) => {
    const principal = requireSupplierFeature(request);
    const current = findMockSupplierOrThrow(request.params.supplierId ?? "");
    const issues: ValidationIssue[] = [];
    const fields = readSupplierFromBody(readJsonObjectBody(request), issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const slice = readMockSupplierSlice();
    slice.suppliers = slice.suppliers.map((supplier) => (supplier.id === current.id ? { ...supplier, ...fields } : supplier));
    recordCatalogAuditEntry(principal, "supplier.updated", "supplier", current.id, `Updated supplier ${fields.name}`);
    return respondWithJson(200, listMockSuppliersWithProductCounts().find((supplier) => supplier.id === current.id));
  });

  registerMockRoute("DELETE", "/seller/suppliers/:supplierId", (request) => {
    const principal = requireSupplierFeature(request);
    const supplier = findMockSupplierOrThrow(request.params.supplierId ?? "");
    const slice = readMockSupplierSlice();
    slice.suppliers = slice.suppliers.filter((candidate) => candidate.id !== supplier.id);
    for (const product of readMockDatabase().products.filter((candidate) => candidate.supplierId === supplier.id)) replaceMockProduct({ ...product, supplierId: null });
    recordCatalogAuditEntry(principal, "supplier.deleted", "supplier", supplier.id, `Removed supplier ${supplier.name}`);
    return respondWithNoContent();
  });
}

export function registerCategoryAndSupplierMockRoutes(): void {
  registerCategoryMockRoutes();
  registerSupplierMockRoutes();
}
