import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { StatusPill, type StatusTone } from "@/components/escrow/statusPill";
import { PhotoEvidencePicker } from "@/components/escrow/photoEvidencePicker";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { useBusinessDocumentsQuery, useSubmitBusinessDocumentMutation } from "@/components/seller/businessDocumentsQueries.hook";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BusinessDocument, BusinessDocumentKind, BusinessDocumentStatus } from "@/types/trust.type";

const STATUS_APPEARANCE: Record<BusinessDocumentStatus, { label: string; tone: StatusTone }> = {
  not_uploaded: { label: "Not uploaded", tone: "neutral" },
  pending: { label: "Pending review", tone: "caution" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
};

function BusinessDocumentCard({ document }: { document: BusinessDocument }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const submit = useSubmitBusinessDocumentMutation();
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const canUpload = document.status === "not_uploaded" || document.status === "rejected";
  const appearance = STATUS_APPEARANCE[document.status];
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text size={15} weight={600} lineHeight={18} style={styles.flex}>{document.label}</Text>
        <StatusPill label={appearance.label} tone={appearance.tone} />
      </View>
      {document.submittedAt ? <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Sent {formatFriendlyDate(document.submittedAt)}</Text> : null}
      {document.status === "rejected" && document.rejectionReason ? <Text size={13} lineHeight={17.5} color={colors.error}>{document.rejectionReason}</Text> : null}
      {canUpload ? (
        <>
          <PhotoEvidencePicker photoUrls={photoUrls} onChangePhotoUrls={setPhotoUrls} maximumPhotos={1} addLabel="Add photo" onUploadingChange={setUploading} keepPhotosOnDevice />
          <Button
            title={document.status === "rejected" ? "Send again" : "Send for review"}
            disabled={photoUrls.length === 0 || uploading}
            loading={submit.isPending}
            onPress={() => submit.mutate({ kind: document.kind as BusinessDocumentKind, localUri: photoUrls[0]! }, { onSuccess: () => setPhotoUrls([]) })}
          />
          {submit.isError ? <Text size={12} color={colors.error} accessibilityRole="alert">{submit.error.message}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

export function BusinessDocumentsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const documents = useBusinessDocumentsQuery();
  return (
    <Screen>
      <Header title="Business documents" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text size={13} lineHeight={17.5} color={colors.textMuted}>
          You can sell without these. Our team reviews them so your business can earn the Gold checkmark. Documents are encrypted and only seen by our verification team.
        </Text>
        {documents.isLoading ? <ListSkeleton rows={3} /> : null}
        {documents.isError ? <ErrorState error={documents.error} message="Couldn't load your documents." onRetry={() => documents.refetch()} /> : null}
        {(documents.data?.documents ?? []).map((document) => <BusinessDocumentCard key={document.kind} document={document} />)}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
}));
