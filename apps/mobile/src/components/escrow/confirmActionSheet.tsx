import { Dialog } from "@/components/ui/dialog";
import type { ModalIntent } from "@/components/ui/modalIntent";

export interface ConfirmActionSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmTitle: string;
  readonly confirming: boolean;
  readonly errorMessage?: string | null;
  readonly destructive?: boolean;
  readonly intent?: ModalIntent;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function ConfirmActionSheet({ visible, title, message, confirmTitle, confirming, errorMessage, destructive = false, intent, onConfirm, onClose }: ConfirmActionSheetProps) {
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      dismissible={!confirming}
      title={title}
      message={message}
      intent={intent}
      tone={destructive ? "destructive" : undefined}
      errorMessage={errorMessage}
      actions={[
        { label: confirmTitle, style: destructive ? "destructive" : "primary", loading: confirming, onPress: onConfirm },
        { label: "Not yet", style: "secondary", disabled: confirming, onPress: onClose },
      ]}
    />
  );
}
