import { Alert, Platform, type AlertButton } from "react-native";

const runButtonAction = (button: AlertButton | undefined) => button?.onPress?.();

export function showAlertWithButtons(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }
  const dialogText = [title, message].filter(Boolean).join("\n\n");
  const cancelButton = buttons?.find((button) => button.style === "cancel");
  const actionButtons = (buttons ?? []).filter((button) => button.style !== "cancel");
  if (actionButtons.length === 0) {
    window.alert(dialogText);
    runButtonAction(cancelButton);
    return;
  }
  const chosenActionButton = actionButtons.find((button) =>
    window.confirm(actionButtons.length === 1 ? dialogText : `${dialogText}\n\n${button.text ?? "Continue"}?`),
  );
  runButtonAction(chosenActionButton ?? cancelButton);
}
