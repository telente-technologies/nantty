import type { AlertButton } from "react-native";

import type { ModalAction } from "@/components/ui/modalActions";
import type { ModalTone } from "@/components/ui/modalChrome.constant";
import type { ModalIntent } from "@/components/ui/modalIntent";
import { showDialog } from "@/store/dialog.store";

const PROBLEM_TITLE_PATTERN = /^(couldn'?t|could not|can'?t|cannot|something went wrong)|not (sent|posted|added|saved)\b/i;

function inferDialogTone(title: string, buttons: readonly AlertButton[]): ModalTone {
  if (buttons.some((button) => button.style === "destructive")) return "destructive";
  if (PROBLEM_TITLE_PATTERN.test(title)) return "caution";
  return "neutral";
}

function orderButtonsAsModalActions(buttons: readonly AlertButton[]): ModalAction[] {
  const cancelButtons = buttons.filter((button) => button.style === "cancel");
  const otherButtons = buttons.filter((button) => button.style !== "cancel");
  const actions: ModalAction[] = otherButtons.map((button, index) => ({
    label: button.text ?? "OK",
    onPress: button.onPress ? () => button.onPress?.() : undefined,
    style: button.style === "destructive" ? "destructive" : index === 0 ? "primary" : "secondary",
  }));
  cancelButtons.forEach((button) => actions.push({ label: button.text ?? "Cancel", onPress: button.onPress ? () => button.onPress?.() : undefined, style: actions.length === 0 ? "primary" : "secondary" }));
  return actions;
}

export interface AlertDialogOptions {
  readonly intent?: ModalIntent;
}

export function showAlertWithButtons(title: string, message?: string, buttons?: AlertButton[], options: AlertDialogOptions = {}) {
  const providedButtons = buttons ?? [];
  const actions = providedButtons.length > 0 ? orderButtonsAsModalActions(providedButtons) : [{ label: "OK", style: "primary" as const }];
  const cancelButton = providedButtons.find((button) => button.style === "cancel");
  const tone = inferDialogTone(title, providedButtons);
  showDialog({
    title,
    message,
    tone: options.intent && tone === "neutral" ? undefined : tone,
    intent: options.intent,
    actions,
    onDismiss: cancelButton?.onPress ? () => cancelButton.onPress?.() : undefined,
  });
}
