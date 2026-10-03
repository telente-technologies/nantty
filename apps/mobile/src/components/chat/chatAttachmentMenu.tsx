import type { ReactNode } from "react";

import { Camera24Icon, Document24Icon, ImageSquare24Icon, MapPin24Icon, Poll24Icon } from "@/components/icons";
import { ActionSheet } from "@/components/ui/actionSheet";

export type ChatAttachmentOption = "photos" | "camera" | "location" | "documents" | "poll";

interface AttachmentOptionRow {
  readonly option: ChatAttachmentOption;
  readonly label: string;
  readonly icon: ReactNode;
}

const OPTIONS: readonly AttachmentOptionRow[] = [
  { option: "photos", label: "Photos", icon: <ImageSquare24Icon /> },
  { option: "camera", label: "Camera", icon: <Camera24Icon /> },
  { option: "location", label: "Location", icon: <MapPin24Icon /> },
  { option: "documents", label: "Documents", icon: <Document24Icon /> },
  { option: "poll", label: "Poll", icon: <Poll24Icon /> },
];

export interface ChatAttachmentMenuProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSelect: (option: ChatAttachmentOption) => void;
}

export function ChatAttachmentMenu({ visible, onClose, onSelect }: ChatAttachmentMenuProps) {
  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title="Attach"
      closeBeforeSelect={false}
      options={OPTIONS.map((row) => ({ label: row.label, icon: row.icon, onPress: () => onSelect(row.option) }))}
    />
  );
}
