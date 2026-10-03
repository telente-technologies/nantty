import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import { buildDemoSuppliersForStore } from "@/mocks/seed/demoSuppliers.mock";
import type { Supplier } from "@/types/catalog.type";

interface SupplierSlice {
  suppliers: Supplier[];
}

export function readMockSupplierSlice(): SupplierSlice {
  return readStoreScopedMockSlice<SupplierSlice>("suppliers", (storeId) => ({ suppliers: buildDemoSuppliersForStore(storeId, new Map()) }));
}

export function listMockSuppliersWithProductCounts(): Supplier[] {
  const productCountBySupplierId = new Map<string, number>();
  for (const product of readMockDatabase().products) {
    if (product.supplierId && product.status !== "archived") productCountBySupplierId.set(product.supplierId, (productCountBySupplierId.get(product.supplierId) ?? 0) + 1);
  }
  return readMockSupplierSlice().suppliers.map((supplier) => ({ ...supplier, productCount: productCountBySupplierId.get(supplier.id) ?? 0 }));
}

export function findMockSupplierOrThrow(supplierId: string): Supplier {
  const supplier = readMockSupplierSlice().suppliers.find((candidate) => candidate.id === supplierId);
  if (!supplier) throw new MockHttpError(404, "SUPPLIER_NOT_FOUND", "That supplier no longer exists.");
  return supplier;
}

export function isKnownMockSupplierId(supplierId: string): boolean {
  return readMockSupplierSlice().suppliers.some((supplier) => supplier.id === supplierId);
}
