import { useState } from "react";
import { Pressable, View } from "react-native";

import { pickPhotosAndVideosFromLibrary } from "@/components/create/pickMedia.util";
import { Text } from "@/components/ui/text";
import { enqueueLocalMediaForUpload, waitForUploadedMediaId } from "@/services/media/mediaUploadQueue.service";
import { useTheme } from "@/theme";
import type { ID } from "@/types";

import { useClaimFieldStyles } from "./copyrightClaimFields";

const MAXIMUM_ATTACHMENTS = 10;

export interface EvidenceAttachment {
  readonly fileName: string;
  readonly uploadJobId: ID;
}

export async function resolveEvidenceMediaIds(attachments: readonly EvidenceAttachment[]): Promise<ID[]> {
  return Promise.all(attachments.map((attachment) => waitForUploadedMediaId(attachment.uploadJobId)));
}

export function CopyrightEvidencePicker({ label, hint, attachments, onChange }: { readonly label: string; readonly hint: string; readonly attachments: readonly EvidenceAttachment[]; readonly onChange: (attachments: EvidenceAttachment[]) => void }) {
  const { colors } = useTheme();
  const styles = useClaimFieldStyles();
  const [isPicking, setIsPicking] = useState(false);
  const pickAndUpload = async () => {
    setIsPicking(true);
    try {
      const picked = await pickPhotosAndVideosFromLibrary(MAXIMUM_ATTACHMENTS - attachments.length);
      const uploads = await Promise.all(picked.map(async (file) => ({ fileName: file.fileName ?? "Attachment", uploadJobId: await enqueueLocalMediaForUpload(file, "dispute_evidence") })));
      onChange([...attachments, ...uploads]);
    } finally {
      setIsPicking(false);
    }
  };
  return (
    <View style={styles.field}>
      <Text size={13} weight={500} lineHeight={16.9}>
        {label}
      </Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        {hint}
      </Text>
      {attachments.map((attachment, index) => (
        <View key={attachment.uploadJobId} style={styles.segmentRow}>
          <Text size={13} lineHeight={18.2} numberOfLines={1} style={styles.declarationText}>
            {attachment.fileName}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${attachment.fileName}`} onPress={() => onChange(attachments.filter((_, position) => position !== index))}>
            <Text size={13} lineHeight={18.2} color={colors.error}>
              Remove
            </Text>
          </Pressable>
        </View>
      ))}
      {attachments.length < MAXIMUM_ATTACHMENTS ? (
        <Pressable accessibilityRole="button" disabled={isPicking} onPress={pickAndUpload}>
          <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>
            {isPicking ? "Adding…" : "Upload from your library"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
