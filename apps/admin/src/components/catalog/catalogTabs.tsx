import { LinkTabs } from "@/components/ui/tabs";

export function CatalogTabs() {
  return (
    <LinkTabs
      label="Catalog sections"
      items={[
        { href: "/catalog/categories", label: "Product categories" },
        { href: "/catalog/topics", label: "Content topics" },
      ]}
    />
  );
}
