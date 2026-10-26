import { StyleSheet, View } from "react-native";

import { BookOpenText24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import type { ModalAction } from "@/components/ui/modalActions";
import { Text } from "@/components/ui/text";
import { usePolicyUpdates } from "@/hooks/usePolicyUpdates.hook";
import { showToast } from "@/store/toast.store";
import { useTheme } from "@/theme";
import type { PolicyVersionSummary } from "@/types";

import { PolicyDocumentCard } from "./policyDocumentCard";
import { formatPolicyEffectiveDate, joinPolicyTitles } from "./policyHighlights.util";

export interface PolicyWhatChangedSheetProps {
  readonly visible: boolean;
  readonly versions: readonly PolicyVersionSummary[];
  readonly onClose: () => void;
  readonly onDismissBanner: () => void;
}

export function PolicyWhatChangedSheet({ visible, versions, onClose, onDismissBanner }: PolicyWhatChangedSheetProps) {
  const { colors } = useTheme();
  const { accept, isAccepting, acceptErrorMessage } = usePolicyUpdates();
  const materialVersions = versions.filter((version) => version.isMaterialChange);
  const acknowledgeAll = async () => {
    try {
      for (const version of versions) await accept(version);
      onClose();
      showToast("Thanks. You're up to date.", { tone: "success" });
    } catch {
      return;
    }
  };
  const actions: ModalAction[] =
    materialVersions.length > 0
      ? [
          { label: "Accept the update", style: "primary", loading: isAccepting, onPress: () => void acknowledgeAll() },
          { label: "Remind me later", style: "secondary", onPress: () => { onDismissBanner(); onClose(); } },
        ]
      : [{ label: "Got it", style: "primary", loading: isAccepting, onPress: () => void acknowledgeAll() }];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="What changed" subtitle={`Updates to our ${joinPolicyTitles(versions)}`} scrollable footerActions={actions}>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <BookOpenText24Icon size={22} color={colors.textMuted} />
        </View>
        {versions.map((version) => (
          <PolicyDocumentCard key={version.policyVersionId} version={version} />
        ))}
        {materialVersions.map((version) => (
          <Text key={version.policyVersionId} size={13} lineHeight={19} color={colors.textMuted} maxFontSizeMultiplier={2}>
            You can keep using Nantty as normal. From {formatPolicyEffectiveDate(version.effectiveAt)} we'll ask you to accept the new {version.title} before you continue.
          </Text>
        ))}
        {acceptErrorMessage ? (
          <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">
            {acceptErrorMessage}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: 14, paddingTop: 4 } });
