import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Cancel20Icon, CameraBolt24Icon } from "@/components/icons";
import { pickSquareOrWideImageFromLibrary } from "@/components/profile/pickImage.util";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { mediaService, type MediaUploadPurpose } from "@/services/media/media.service";

export interface PhotoEvidencePickerProps {
  readonly photoUrls: readonly string[];
  readonly onChangePhotoUrls: (photoUrls: string[]) => void;
  readonly maximumPhotos?: number;
  readonly addLabel?: string;
  readonly onUploadingChange?: (uploading: boolean) => void;
  readonly keepPhotosOnDevice?: boolean;
  readonly privateUploadPurpose?: Extract<MediaUploadPurpose, "dispute_evidence" | "identity_document" | "verification_document">;
}

export function PhotoEvidencePicker({ photoUrls, onChangePhotoUrls, maximumPhotos = 5, addLabel = "Add photo", onUploadingChange, keepPhotosOnDevice = false, privateUploadPurpose = "dispute_evidence" }: PhotoEvidencePickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickAndUploadEvidencePhoto = async () => {
    const picked = await pickSquareOrWideImageFromLibrary([4, 3]);
    if (!picked) return;
    if (keepPhotosOnDevice) {
      onChangePhotoUrls([...photoUrls, picked.uri]);
      return;
    }
    setUploadError(null);
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const uploadedUrl = await mediaService.uploadLocalImageAndReturnPublicUrl(picked.uri, picked.contentType, privateUploadPurpose);
      onChangePhotoUrls([...photoUrls, uploadedUrl]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photoUrls.map((url, index) => (
          <View key={url} style={styles.thumbnail}>
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Evidence photo ${index + 1}`} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={8}
              onPress={() => onChangePhotoUrls(photoUrls.filter((existing) => existing !== url))}
              style={styles.remove}
            >
              <Cancel20Icon size={14} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {photoUrls.length < maximumPhotos ? (
          <Pressable accessibilityRole="button" accessibilityLabel={addLabel} onPress={pickAndUploadEvidencePhoto} disabled={uploading} style={[styles.thumbnail, styles.add]}>
            {uploading ? <ActivityIndicator color={colors.primary} /> : <CameraBolt24Icon />}
            <Text size={12} lineHeight={16} color={colors.textMuted} align="center">
              {uploading ? "Uploading…" : addLabel}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {uploadError ? (
        <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">
          {uploadError}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  row: { gap: 8 },
  thumbnail: { width: 88, height: 88, borderRadius: 8, backgroundColor: colors.surface, overflow: "hidden" },
  add: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.textSubtle, alignItems: "center", justifyContent: "center", gap: 4, padding: 4 },
  remove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" },
}));
