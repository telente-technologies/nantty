"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Brand, BrandMemberRole, BrandSummary, MyStoreEntry } from "@/types/brand.type";
import type { CursorPage } from "@/types/pagination.type";
import { brandRegistrationLabels, officialStoreLabels } from "@/utils/brandPresentation.util";
import { readMyStoreEntries, type MyStoresResponse } from "@/utils/myStores.util";

interface BrandWorkspaceValue {
  readonly brand: Brand;
  readonly myRole: BrandMemberRole | null;
  readonly myStores: MyStoreEntry[];
  readonly canEditDashboardSettings: boolean;
  readonly replaceBrand: (brand: Brand) => void;
  readonly reloadBrand: () => void;
}

const BrandWorkspaceContext = createContext<BrandWorkspaceValue | null>(null);
const selectedBrandStorageKey = "zudomart-dashboard-selected-brand";

export function useBrandWorkspace(): BrandWorkspaceValue {
  const value = useContext(BrandWorkspaceContext);
  if (!value) throw new Error("useBrandWorkspace must be used inside BrandWorkspace.");
  return value;
}

function readRememberedBrandId(): string | null {
  try {
    return window.localStorage.getItem(selectedBrandStorageKey);
  } catch {
    return null;
  }
}

export function BrandWorkspace({ children }: { readonly children: ReactNode }) {
  const { sessionView, can } = useSellerSession();
  const brandsQuery = useSellerQuery<CursorPage<BrandSummary>>("/seller/brands");
  const storesQuery = useSellerQuery<MyStoresResponse>("/seller/stores/mine");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const brands = useMemo(() => brandsQuery.data?.data ?? [], [brandsQuery.data]);
  const myStores = useMemo(() => readMyStoreEntries(storesQuery.data), [storesQuery.data]);

  useEffect(() => {
    if (selectedBrandId || brands.length === 0) return;
    const remembered = readRememberedBrandId();
    const currentStoreBrandId = myStores.find((store) => store.storeId === sessionView?.access.storeId)?.brandId ?? null;
    const preferredId = [remembered, currentStoreBrandId].find((candidate) => candidate && brands.some((brand) => brand.id === candidate));
    setSelectedBrandId(preferredId ?? brands[0]?.id ?? null);
  }, [brands, myStores, selectedBrandId, sessionView?.access.storeId]);

  const brandQuery = useSellerQuery<Brand>(selectedBrandId ? `/seller/brands/${encodeURIComponent(selectedBrandId)}` : null);
  const brand = brandQuery.data;

  function chooseBrand(brandId: string) {
    setSelectedBrandId(brandId);
    try {
      window.localStorage.setItem(selectedBrandStorageKey, brandId);
    } catch {
      return;
    }
  }

  const contextValue = useMemo<BrandWorkspaceValue | null>(() => {
    if (!brand) return null;
    return {
      brand,
      myRole: brand.members.find((member) => member.userId === sessionView?.user.id)?.role ?? null,
      myStores,
      canEditDashboardSettings: can("settings:manage"),
      replaceBrand: (updatedBrand) => brandQuery.replaceData(() => updatedBrand),
      reloadBrand: brandQuery.reload,
    };
  }, [brand, myStores, sessionView?.user.id, can, brandQuery]);

  if (brandsQuery.isLoading) return <LoadingBlock label="Loading your brands" />;
  if (brandsQuery.errorMessage) return <ErrorCallout message={brandsQuery.errorMessage} onRetry={brandsQuery.reload} />;
  if (brands.length === 0) {
    return (
      <PageStack>
        <PageHeader title="Brand" description="Sell under your own brand name and protect it from counterfeits." />
        <EmptyState iconName="sealCheck20" title="You don't manage a brand yet" description="Create your brand in the Zudomart app (Profile › Your brand), then link this store to it here." action={<ButtonLink href="/settings" variant="secondary">Back to settings</ButtonLink>} />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageHeader
        eyebrow="Brand"
        title={brand?.name ?? "Brand"}
        description="Your brand profile, team, stores, Official Store badge and brand protection."
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {brand ? <StatusBadge tone={brandRegistrationLabels[brand.registration.status].tone}>{brandRegistrationLabels[brand.registration.status].label}</StatusBadge> : null}
            {brand ? <StatusBadge tone={officialStoreLabels[brand.officialStore.status].tone}>{officialStoreLabels[brand.officialStore.status].label}</StatusBadge> : null}
            {brands.length > 1 ? (
              <SelectField label="Brand" hideLabel value={selectedBrandId ?? ""} onChange={(event) => chooseBrand(event.target.value)} options={brands.map((summary) => ({ value: summary.id, label: summary.name }))} />
            ) : null}
          </div>
        }
      />
      <LinkTabs
        label="Brand sections"
        tabs={[
          { href: "/brand", label: "Profile", exact: true },
          { href: "/brand/members", label: "Members & roles" },
          { href: "/brand/stores", label: "Stores" },
          { href: "/brand/official-store", label: "Official Store" },
          { href: "/brand/protection", label: "Protection" },
        ]}
      />
      {brandQuery.errorMessage ? <ErrorCallout message={brandQuery.errorMessage} onRetry={brandQuery.reload} /> : null}
      {contextValue ? <BrandWorkspaceContext.Provider value={contextValue}>{children}</BrandWorkspaceContext.Provider> : <LoadingBlock label="Loading brand" />}
    </PageStack>
  );
}
