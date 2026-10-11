"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { ModalDialog } from "@/components/ui/modalDialog";
import { IconLabel } from "@/components/ui/zudoIcon";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Product } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./messages.module.css";

export type SharedPick = { readonly kind: "product"; readonly id: string; readonly label: string } | { readonly kind: "order"; readonly id: string; readonly label: string };

interface ShareItemDialogProps {
  readonly isOpen: boolean;
  readonly order: { readonly id: string; readonly orderNumber: string } | null;
  readonly onClose: () => void;
  readonly onShare: (pick: SharedPick) => void;
}

export function ShareItemDialog({ isOpen, order, onClose, onShare }: ShareItemDialogProps) {
  const [searchText, setSearchText] = useState("");
  const [picked, setPicked] = useState<SharedPick | null>(null);
  const products = useSellerQuery<CursorPage<Product>>(isOpen ? "/seller/products" : null, { q: searchText, status: "active", limit: 20 });

  function close() {
    setPicked(null);
    setSearchText("");
    onClose();
  }

  function share() {
    if (!picked) return;
    onShare(picked);
    close();
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      title="Share in this chat"
      description="Send a product or this conversation's order as a card. It's end-to-end encrypted like every message."
      intent="share"
      onClose={close}
      footer={(
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" iconName="shareFat24" disabled={!picked} onClick={share}>Share</Button>
        </>
      )}
    >
      {order ? (
        <Button className={styles.pickerOption} aria-pressed={picked?.kind === "order"} onClick={() => setPicked({ kind: "order", id: order.id, label: `Order ${order.orderNumber}` })}>
          <IconLabel name="receipt24" size={18}>Order {order.orderNumber}</IconLabel>
        </Button>
      ) : null}
      <SearchInput label="Search products" placeholder="Product name or SKU" value={searchText} onValueChange={setSearchText} />
      {products.isLoading && !products.data ? <LoadingBlock label="Loading products" rows={3} /> : null}
      {products.errorMessage ? <p role="alert">{products.errorMessage}</p> : null}
      <ul className={styles.pickerList}>
        {(products.data?.data ?? []).map((product) => (
          <li key={product.id}>
            <Button className={styles.pickerOption} aria-pressed={picked?.kind === "product" && picked.id === product.id} onClick={() => setPicked({ kind: "product", id: product.id, label: product.name })}>
              <IconLabel name="package24" size={18}>{product.name}</IconLabel>
            </Button>
          </li>
        ))}
        {products.data && products.data.data.length === 0 ? <li className={styles.preview}>No active products match.</li> : null}
      </ul>
    </ModalDialog>
  );
}
