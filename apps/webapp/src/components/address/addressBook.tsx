"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { MapPinIcon, PlusIcon } from "@/components/ui/icons";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";
import type { Address, ShippingAddressInput } from "@/types";

import { AddressForm } from "./addressForm";
import { addressToInput, emptyAddressInput, formatAddressLocation } from "./addressForm.util";
import styles from "./addressBook.module.css";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";

export const addressesQueryKey = ["addresses"] as const;

export function useAddressMutations(onDone?: (address: Address | null) => void) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: addressesQueryKey });
    void queryClient.invalidateQueries({ queryKey: ["cart", "shipping-quote"] });
  };
  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ShippingAddressInput }) =>
      id ? usersService.updateShippingAddress(id, input) : usersService.createShippingAddress(input),
    onSuccess: (address) => {
      refresh();
      onDone?.(address);
    },
  });
  const remove = useMutation({
    mutationFn: usersService.deleteShippingAddress,
    onSuccess: () => {
      refresh();
      onDone?.(null);
    },
  });
  return { save, remove };
}

export function AddressEditorDialog({ address, isOpen, onClose, onSaved }: { readonly address: Address | null; readonly isOpen: boolean; readonly onClose: () => void; readonly onSaved?: (address: Address) => void }) {
  const { save } = useAddressMutations((saved) => {
    if (saved) onSaved?.(saved);
    onClose();
  });
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={address ? "Edit address" : "Add address"} layout="sheet" size="large">
      <AddressForm
        key={address?.id ?? "new"}
        initial={address ? addressToInput(address) : emptyAddressInput}
        submitLabel="Save address"
        busy={save.isPending}
        serverError={save.isError ? readErrorMessageForDisplay(save.error) : null}
        onSubmit={(input) => save.mutate({ id: address?.id ?? null, input })}
        onCancel={onClose}
      />
    </Dialog>
  );
}

export function AddressBook() {
  const query = useQuery({ queryKey: addressesQueryKey, queryFn: usersService.listMyShippingAddresses, retry: false });
  const { remove } = useAddressMutations();
  const [editing, setEditing] = useState<Address | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);

  const openEditor = (address: Address | null) => {
    setEditing(address);
    setEditorOpen(true);
  };

  if (query.isLoading) return <ListRowsSkeleton label="Loading your addresses" rows={3} withAvatar={false} />;
  if (query.isError) return <ErrorState description="We couldn't load your addresses." action={<RetryButton onRetry={() => query.refetch()} />} />;
  const addresses = query.data ?? [];

  return (
    <section className={styles.book} aria-label="Address book">
      <div className={styles.toolbar}>
        <Button leadingIcon={<PlusIcon size={16} />} onClick={() => openEditor(null)}>
          Add address
        </Button>
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPinIcon size={28} />} title="No saved addresses" description="Add one to speed up checkout." />
      ) : (
        <ul className={styles.list}>
          {addresses.map((address) => (
            <li key={address.id} className={styles.card}>
              <MapPinIcon size={18} />
              <div className={styles.text}>
                <span className={styles.name}>
                  {address.fullName}
                  {address.isDefault ? <span className={styles.tag}>Default</span> : null}
                </span>
                <span className={styles.meta}>{formatAddressLocation(address)}</span>
                <span className={styles.meta}>{address.phone}</span>
              </div>
              <div className={styles.actions}>
                <Button size="sm" variant="secondary" onClick={() => openEditor(address)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" busy={remove.isPending && remove.variables === address.id} onClick={() => remove.mutate(address.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddressEditorDialog address={editing} isOpen={isEditorOpen} onClose={() => setEditorOpen(false)} />
    </section>
  );
}
