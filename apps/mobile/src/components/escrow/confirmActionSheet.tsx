import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface ConfirmActionSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmTitle: string;
  readonly confirming: boolean;
  readonly errorMessage?: string | null;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function ConfirmActionSheet({ visible, title, message, confirmTitle, confirming, errorMessage, destructive = false, onConfirm, onClose }: ConfirmActionSheetProps) {
  const { colors } = useTheme();
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      dismissible={!confirming}
      title={title}
      message={message}
      tone={destructive ? "destructive" : "neutral"}
      actions={[
        { label: confirmTitle, style: destructive ? "destructive" : "primary", loading: confirming, onPress: onConfirm },
        { label: "Not yet", style: "secondary", disabled: confirming, onPress: onClose },
      ]}
    >
      {errorMessage ? (
        <Text size={13} lineHeight={18} align="center" color={colors.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
    </Dialog>
  );
}
