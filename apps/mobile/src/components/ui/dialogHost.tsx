import { useEffect, useRef, useState } from "react";

import { useDialogStore, type DialogRequest } from "@/store/dialog.store";

import { Dialog } from "./dialog";
import type { ModalAction } from "./modalActions";
import { inferModalIntent } from "./modalIntent";

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === "function";
}

function describeActionError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}

function resolveIntent(request: DialogRequest) {
  if (request.intent) return request.intent;
  if (request.icon) return undefined;
  return inferModalIntent(request.tone ?? "neutral");
}

export function DialogHost() {
  const current = useDialogStore((state) => state.queue[0]);
  const closeCurrentDialog = useDialogStore((state) => state.closeCurrentDialog);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const currentId = current?.id;
  useEffect(() => {
    inFlight.current = false;
    setPendingLabel(null);
    setErrorMessage(null);
  }, [currentId]);
  if (!current) return null;
  const closeIfStillCurrent = () => {
    if (useDialogStore.getState().queue[0]?.id === current.id) closeCurrentDialog();
  };
  const dismiss = () => {
    if (inFlight.current) return;
    closeCurrentDialog();
    current.onDismiss?.();
  };
  const run = (action: ModalAction) => {
    if (inFlight.current) return;
    const result = action.onPress?.();
    if (!isPromiseLike(result)) {
      closeIfStillCurrent();
      return;
    }
    inFlight.current = true;
    setPendingLabel(action.label);
    setErrorMessage(null);
    result.then(
      () => {
        inFlight.current = false;
        closeIfStillCurrent();
      },
      (error: unknown) => {
        inFlight.current = false;
        setPendingLabel(null);
        setErrorMessage(describeActionError(error));
      },
    );
  };
  const actions = (current.actions ?? [{ label: "OK", style: "primary" as const }]).map((action) => ({
    ...action,
    loading: pendingLabel === action.label,
    disabled: action.disabled || (pendingLabel !== null && pendingLabel !== action.label),
    onPress: () => run(action),
  }));
  return (
    <Dialog
      key={current.id}
      visible
      onClose={dismiss}
      dismissible={current.dismissible ?? true}
      title={current.title}
      message={current.message}
      tone={current.tone}
      intent={resolveIntent(current)}
      icon={current.icon}
      errorMessage={errorMessage}
      actions={actions}
    />
  );
}
