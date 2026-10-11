import type { ReactNode } from "react";
import { create } from "zustand";

import type { ModalAction } from "@/components/ui/modalActions";
import type { ModalTone } from "@/components/ui/modalChrome.constant";
import type { ModalIntent } from "@/components/ui/modalIntent";

export interface DialogRequest {
  readonly title: string;
  readonly message?: string;
  readonly tone?: ModalTone;
  readonly intent?: ModalIntent;
  readonly icon?: ReactNode;
  readonly actions?: readonly ModalAction[];
  readonly dismissible?: boolean;
  readonly onDismiss?: () => void;
}

interface QueuedDialog extends DialogRequest {
  readonly id: number;
}

interface DialogState {
  readonly queue: readonly QueuedDialog[];
  readonly showDialog: (request: DialogRequest) => void;
  readonly closeCurrentDialog: () => void;
}

let nextDialogId = 1;

export const useDialogStore = create<DialogState>((set) => ({
  queue: [],
  showDialog: (request) => set((state) => ({ queue: [...state.queue, { ...request, id: nextDialogId++ }] })),
  closeCurrentDialog: () => set((state) => ({ queue: state.queue.slice(1) })),
}));

export const showDialog = (request: DialogRequest) => useDialogStore.getState().showDialog(request);
