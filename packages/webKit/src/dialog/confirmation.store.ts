import type { ReactNode } from "react";

import type { DialogIntent, DialogTone } from "./dialogIntent";

export interface ConfirmationRequest {
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: DialogTone;
  readonly intent?: DialogIntent;
  readonly icon?: ReactNode;
  readonly onConfirm?: () => unknown;
  readonly describeError?: (error: unknown) => string;
}

interface PendingConfirmation extends ConfirmationRequest {
  readonly id: number;
  readonly resolve: (confirmed: boolean) => void;
}

export interface ConfirmationSnapshot {
  readonly pending: PendingConfirmation | null;
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
}

const closedSnapshot: ConfirmationSnapshot = { pending: null, isOpen: false, isSubmitting: false, errorMessage: null };

function defaultErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "That didn't work. Nothing was changed. Please try again.";
}

export function createConfirmationStore() {
  let snapshot = closedSnapshot;
  let nextId = 1;
  const listeners = new Set<() => void>();
  const update = (next: Partial<ConfirmationSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const settle = (confirmed: boolean) => {
    const current = snapshot.pending;
    if (!current) return;
    update({ isOpen: false, isSubmitting: false, errorMessage: null });
    current.resolve(confirmed);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => closedSnapshot,
    request(request: ConfirmationRequest): Promise<boolean> {
      return new Promise((resolve) => {
        if (snapshot.pending && snapshot.isOpen) snapshot.pending.resolve(false);
        update({ pending: { ...request, id: nextId++, resolve }, isOpen: true, isSubmitting: false, errorMessage: null });
      });
    },
    async confirm(): Promise<void> {
      const current = snapshot.pending;
      if (!current || !snapshot.isOpen || snapshot.isSubmitting) return;
      if (!current.onConfirm) return settle(true);
      update({ isSubmitting: true, errorMessage: null });
      try {
        await current.onConfirm();
        if (snapshot.pending?.id === current.id) settle(true);
      } catch (error) {
        if (snapshot.pending?.id === current.id) update({ isSubmitting: false, errorMessage: (current.describeError ?? defaultErrorMessage)(error) });
      }
    },
    cancel() {
      if (snapshot.isSubmitting) return;
      settle(false);
    },
  };
}

export type ConfirmationStore = ReturnType<typeof createConfirmationStore>;

export const confirmationStore = createConfirmationStore();

export function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
  return confirmationStore.request(request);
}
