import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { LinkTabs } from "@/components/ui/navigationTabs";

export function ProductsSectionTabs() {
  const { can } = useSellerSession();
  const tabs = [
    { href: "/products", label: "All products", exact: true },
    { href: "/products/categories", label: "Categories" },
    { href: "/products/import", label: "Import & export" },
    { href: "/products/labels", label: "Labels" },
  ];
  return (
    <LinkTabs
      label="Product sections"
      tabs={can("products:manage") ? tabs : tabs.slice(0, 1)}
    />
  );
}
