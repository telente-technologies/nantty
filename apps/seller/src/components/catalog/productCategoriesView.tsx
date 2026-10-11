"use client";

import Link from "next/link";
import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { CategoryFormDialog } from "@/components/catalog/categoryFormDialog";
import { ProductsSectionTabs } from "@/components/catalog/productsSectionTabs";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { TablePagination } from "@/components/ui/tablePagination";
import { useToast } from "@/components/ui/toastProvider";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductCategory } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./productListView.module.css";

const categorySortReaders = { name: (category: ProductCategory) => category.name, products: (category: ProductCategory) => category.productCount ?? 0 };

export function ProductCategoriesView() {
  const { showToast } = useToast();
  const categoriesQuery = useSellerQuery<CursorPage<ProductCategory>>("/seller/categories");
  const [searchText, setSearchText] = useState("");
  const [editingCategory, setEditingCategory] = useState<ProductCategory | "new" | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const needle = searchText.trim().toLowerCase();
  const matchingCategories = categoriesQuery.data ? categoriesQuery.data.data.filter((category) => !needle || category.name.toLowerCase().includes(needle)) : null;
  const table = useClientTableState(matchingCategories, categorySortReaders, { pageSize: 10, initialSort: { key: "name", direction: "ascending" } });

  async function deleteCategory(category: ProductCategory) {
    const productCount = category.productCount ?? 0;
    if (!(await requestConfirmation({ title: `Delete ${category.name}?`, description: productCount > 0 ? `Its ${productCount} product(s) stay in your store with no category.` : undefined, confirmLabel: "Delete category", tone: "danger", intent: "delete" }))) return;
    setDeletingCategoryId(category.id);
    try {
      await sendSellerApiRequest(`/seller/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
      showToast(`${category.name} deleted.`);
      categoriesQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setDeletingCategoryId(null);
    }
  }

  const columns: DataTableColumn<ProductCategory>[] = [
    { key: "name", header: "Category", sortKey: "name", render: (category) => <span className={styles.productCell}><span><span className={styles.productName}>{category.name}</span><span className={styles.productMeta}>{category.description || "No description"}</span></span></span> },
    { key: "products", header: "Products", align: "end", sortKey: "products", render: (category) => <Link href={`/products?categoryId=${encodeURIComponent(category.id)}`}>{category.productCount ?? 0}</Link> },
    {
      key: "actions",
      header: <span className="visuallyHidden">Actions</span>,
      align: "end",
      render: (category) => (
        <span className={styles.headerActions} style={{ justifyContent: "flex-end" }}>
          <Button size="small" variant="ghost" onClick={() => setEditingCategory(category)}>Edit</Button>
          <Button size="small" variant="ghost" isBusy={deletingCategoryId === category.id} onClick={() => void deleteCategory(category)}>Delete</Button>
        </span>
      ),
    },
  ];

  return (
    <PageStack>
      <PageHeader title="Categories" description="Group products so customers can browse your store page, and so reports and promotions can target them." actions={<Button variant="primary" iconName="plus16" onClick={() => setEditingCategory("new")}>New category</Button>} />
      <ProductsSectionTabs />
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <FilterBar>
            <SearchInput label="Search categories" placeholder="Search categories" value={searchText} onValueChange={setSearchText} />
          </FilterBar>
        </div>
        <DataTable
          caption="Product categories"
          columns={columns}
          rows={table.visibleRows}
          readRowKey={(category) => category.id}
          isLoading={categoriesQuery.isLoading}
          errorMessage={categoriesQuery.errorMessage}
          onRetry={categoriesQuery.reload}
          sortState={table.sortState}
          onSortChange={table.setSortState}
          emptyState={<EmptyState iconName="tag24" title={needle ? "No categories match" : "No categories yet"} description="Add categories such as Fashion, Bags or Beauty & care." />}
          footer={<TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="categories" />}
        />
      </Panel>
      {editingCategory ? <CategoryFormDialog key={editingCategory === "new" ? "new" : editingCategory.id} category={editingCategory === "new" ? null : editingCategory} onClose={() => setEditingCategory(null)} onSaved={() => { setEditingCategory(null); categoriesQuery.reload(); }} /> : null}
    </PageStack>
  );
}
