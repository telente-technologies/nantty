import { LinkTabs } from "@/components/ui/navigationTabs";

export function InventoryTabs() {
  return (
    <LinkTabs
      label="Inventory sections"
      tabs={[
        { href: "/inventory", label: "Stock levels", exact: true },
        { href: "/inventory/adjustments", label: "Adjustments" },
        { href: "/inventory/transfers", label: "Transfers" },
      ]}
    />
  );
}
