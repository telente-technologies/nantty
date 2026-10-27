"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import type { NavigationGroup, NavigationItem } from "@/config/navigation.config";
import type { SellerPermission } from "@/config/rolePermissions.config";

import styles from "./commandPalette.module.css";

const quickActions: (NavigationItem & { readonly permission: SellerPermission })[] = [
  { label: "New product", href: "/products/new", iconName: "plus16", permission: "products:manage", keywords: "add create item" },
  { label: "Import or export products", href: "/products/import", iconName: "export24", permission: "products:manage", keywords: "bulk upload spreadsheet csv" },
  { label: "Adjust stock", href: "/inventory/adjustments", iconName: "boxArrowDown24", permission: "inventory:manage", keywords: "count damaged received" },
  { label: "Stock movements", href: "/inventory/movements", iconName: "repeat24", permission: "inventory:manage", keywords: "history ledger" },
  { label: "Suppliers", href: "/inventory/suppliers", iconName: "buildingStore20", permission: "inventory:manage", keywords: "vendor purchase reorder" },
  { label: "New orders", href: "/orders?status=new", iconName: "shoppingCart24", permission: "orders:view", keywords: "accept pending" },
  { label: "Returns", href: "/orders/returns", iconName: "repeat24", permission: "orders:view", keywords: "refund" },
  { label: "Disputes", href: "/orders/disputes", iconName: "warning20", permission: "orders:view", keywords: "complaint" },
  { label: "Delivery areas and fees", href: "/delivery/settings", iconName: "mapPin24", permission: "delivery:manage", keywords: "shipping zones" },
  { label: "Customer segments", href: "/customers/segments", iconName: "userCircle24", permission: "customers:view", keywords: "groups vip" },
  { label: "New discount code", href: "/promotions/new", iconName: "star16", permission: "promotions:manage", keywords: "coupon sale promotion" },
  { label: "Add a team member", href: "/staff/invite", iconName: "shield24", permission: "staff:manage", keywords: "staff employee username" },
  { label: "Team activity log", href: "/staff/activity", iconName: "textIndent24", permission: "audit:view", keywords: "audit history" },
  { label: "Withdraw to bank", href: "/wallet/withdraw", iconName: "creditCard24", permission: "wallet:withdraw", keywords: "payout cash out" },
  { label: "Download statement", href: "/wallet/statements", iconName: "export24", permission: "wallet:view", keywords: "bank statement pdf" },
  { label: "API keys and webhooks", href: "/settings/developers", iconName: "slidersHorizontal24", permission: "developer:manage", keywords: "developer integration" },
  { label: "Plan and billing", href: "/settings/billing", iconName: "sealCheck20", permission: "billing:manage", keywords: "subscription upgrade pro business invoice" },
];

export function CommandPalette({ isOpen, onClose, groups }: { readonly isOpen: boolean; readonly onClose: () => void; readonly groups: NavigationGroup[] }) {
  const router = useRouter();
  const { can } = useSellerSession();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [searchText, setSearchText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const matchingCommands = useMemo(() => {
    const everyCommand = [...groups.flatMap((group) => group.items), ...quickActions].filter((command) => can(command.permission));
    const needle = searchText.trim().toLowerCase();
    if (!needle) return everyCommand;
    return everyCommand.filter((command) => `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(needle));
  }, [groups, can, searchText]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      setSearchText("");
      setHighlightedIndex(0);
      dialog.showModal();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function runCommand(command: NavigationItem | undefined) {
    if (!command) return;
    onClose();
    if (command.external) window.open(command.href, "_blank", "noopener,noreferrer");
    else router.push(command.href);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.palette}
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.searchRow}>
        <NanttyIcon name="magnifyingGlass20" size={18} />
        <input
          autoFocus
          className={styles.searchInput}
          placeholder="Search pages and actions"
          value={searchText}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-activedescendant={matchingCommands[highlightedIndex] ? `command-${highlightedIndex}` : undefined}
          onChange={(event) => {
            setSearchText(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((index) => Math.min(index + 1, matchingCommands.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              runCommand(matchingCommands[highlightedIndex]);
            }
          }}
        />
        <kbd className={styles.escape}>Esc</kbd>
      </div>
      <ul id="command-palette-results" role="listbox" className={styles.results}>
        {matchingCommands.length === 0 ? <li className={styles.noResults}>No pages or actions match “{searchText}”.</li> : null}
        {matchingCommands.map((command, index) => (
          <li
            key={`${command.href}-${command.label}`}
            id={`command-${index}`}
            role="option"
            aria-selected={index === highlightedIndex}
            className={styles.result}
            onMouseEnter={() => setHighlightedIndex(index)}
            onClick={() => runCommand(command)}
          >
            <NanttyIcon name={command.iconName} size={16} />
            <span>{command.label}</span>
            {command.external ? <span className={styles.externalHint}>Opens Ads Manager</span> : null}
          </li>
        ))}
      </ul>
    </dialog>
  );
}
