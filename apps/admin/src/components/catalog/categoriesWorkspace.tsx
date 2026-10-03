"use client";

import { useMemo, useState, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { zudoIconNames, type ZudoIconName } from "@/constants/zudoIconNames.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import { fetchCatalogCategories, moveCatalogCategory } from "@/services/catalogApi.service";
import type { CatalogCategory } from "@/types/catalog.type";
import { formatWholeNumber } from "@/utils/formatting.util";

import { CatalogTabs } from "./catalogTabs";
import styles from "./categoriesWorkspace.module.css";
import { CategoryDetailPanel } from "./categoryDetailPanel";
import { CategoryEditorDialog } from "./categoryEditorDialog";
import { filterCategoryTreeRowsBySearch, flattenCategoriesIntoTreeRows, type CategoryTreeRow } from "./categoryTreeRows.util";

function isKnownZudoIconName(candidate: string | null): candidate is ZudoIconName {
  return candidate !== null && (zudoIconNames as readonly string[]).includes(candidate);
}

export function CategoriesWorkspace() {
  const { showToast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ category: CatalogCategory | null } | null>(null);
  const [changeCounter, setChangeCounter] = useState(0);
  const { data, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchCatalogCategories(signal), "categories");
  const categories = useMemo(() => data?.items ?? [], [data]);
  const rows = useMemo(() => filterCategoryTreeRowsBySearch(flattenCategoriesIntoTreeRows(categories), searchText), [categories, searchText]);
  const selectedRow = rows.find((row) => row.category.id === selectedCategoryId) ?? null;

  function refreshAfterChange() {
    setChangeCounter((current) => current + 1);
    reload();
  }

  async function moveCategory(event: MouseEvent, category: CatalogCategory, direction: "up" | "down") {
    event.stopPropagation();
    try {
      const result = await moveCatalogCategory(category.id, direction);
      replaceData(() => result);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  const columns: DataTableColumn<CategoryTreeRow>[] = [
    {
      key: "name",
      header: "Category",
      render: (row) => (
        <span className={row.depth === 0 ? styles.parentName : styles.childName}>
          {row.depth === 1 ? <span className={styles.branch} aria-hidden /> : null}
          {isKnownZudoIconName(row.category.iconName) ? <ZudoIcon name={row.category.iconName} size={15} /> : null}
          {row.category.name}
        </span>
      ),
    },
    { key: "slug", header: "Slug", isMono: true, render: (row) => row.category.slug },
    { key: "products", header: "Products", align: "end", render: (row) => formatWholeNumber(row.category.productCount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.category.isActive ? "ACTIVE" : "DISABLED"} label={row.category.isActive ? "Active" : "Inactive"} /> },
    {
      key: "order",
      header: "Order",
      width: "88px",
      render: (row) => (
        <span className={styles.orderButtons}>
          <Button size="small" variant="ghost" iconName="caretDown24" className={styles.upArrow} aria-label={`Move ${row.category.name} up`} disabled={row.isFirstSibling || Boolean(searchText)} onClick={(event) => void moveCategory(event, row.category, "up")} />
          <Button size="small" variant="ghost" iconName="caretDown24" aria-label={`Move ${row.category.name} down`} disabled={row.isLastSibling || Boolean(searchText)} onClick={(event) => void moveCategory(event, row.category, "down")} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader area="Content" title="Categories & topics" description="Product categories shape Mart browse and seller listings. Two levels: department and subcategory." actions={<Button variant="primary" iconName="plus16" onClick={() => setEditor({ category: null })}>Add category</Button>} />
      <CatalogTabs />
      <Toolbar>
        <TextField label="Filter categories" isLabelHidden placeholder="Filter by name or slug" value={searchText} onChange={(event) => setSearchText(event.target.value)} className={styles.search} />
        <span className={styles.muted}>{categories.filter((category) => category.parentId === null).length} departments · {categories.filter((category) => category.parentId !== null).length} subcategories</span>
      </Toolbar>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Product categories" columns={columns} rows={rows} readRowKey={(row) => row.category.id} onRowOpen={(row) => setSelectedCategoryId(row.category.id)} selectedRowKey={selectedCategoryId} isLoading={isLoading} emptyMessage="No categories match this filter." readRowTone={(row) => (row.category.isActive ? null : "caution")} />
      {selectedRow ? (
        <CategoryDetailPanel category={selectedRow.category} parentName={selectedRow.parentName} changeCounter={changeCounter} onClose={() => setSelectedCategoryId(null)} onEdit={() => setEditor({ category: selectedRow.category })} onChanged={refreshAfterChange} />
      ) : null}
      {editor ? (
        <CategoryEditorDialog
          editingCategory={editor.category}
          categories={categories}
          onClose={() => setEditor(null)}
          onSaved={(category) => {
            setEditor(null);
            showToast(editor.category ? `${category.name} saved` : `${category.name} added`);
            setSelectedCategoryId(category.id);
            refreshAfterChange();
          }}
        />
      ) : null}
    </>
  );
}
