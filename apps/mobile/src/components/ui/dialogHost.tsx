import { Check16Icon, Trash24Icon, Warning20Icon } from "@/components/icons";
import { useDialogStore } from "@/store/dialog.store";
import { useTheme } from "@/theme";

import { Dialog } from "./dialog";
import { buildModalToneColors, type ModalTone } from "./modalChrome.constant";

function DefaultToneIcon({ tone }: { readonly tone: ModalTone }) {
  const { colors, scheme } = useTheme();
  const ink = buildModalToneColors(colors, scheme, tone).ink;
  if (tone === "destructive") return <Trash24Icon color={ink} />;
  if (tone === "caution") return <Warning20Icon size={24} color={ink} />;
  if (tone === "success") return <Check16Icon size={22} color={ink} />;
  return null;
}

export function DialogHost() {
  const current = useDialogStore((state) => state.queue[0]);
  const closeCurrentDialog = useDialogStore((state) => state.closeCurrentDialog);
  if (!current) return null;
  const tone = current.tone ?? "neutral";
  const dismiss = () => {
    closeCurrentDialog();
    current.onDismiss?.();
  };
  const actions = (current.actions ?? [{ label: "OK", style: "primary" as const }]).map((action) => ({
    ...action,
    onPress: () => {
      closeCurrentDialog();
      action.onPress?.();
    },
  }));
  return (
    <Dialog
      key={current.id}
      visible
      onClose={dismiss}
      dismissible={current.dismissible ?? true}
      title={current.title}
      message={current.message}
      tone={tone}
      icon={current.icon ?? <DefaultToneIcon tone={tone} />}
      actions={actions}
    />
  );
}
