import { LinkTabs } from "@/components/ui/navigationTabs";

export function ProductsSectionTabs() {
  return (
    <LinkTabs
      label="Product sections"
      tabs={[
        { href: "/products", label: "All products", exact: true },
        { href: "/products/categories", label: "Categories" },
        { href: "/products/import", label: "Import & export" },
        { href: "/products/labels", label: "Labels" },
      ]}
    />
  );
}
