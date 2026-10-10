import { Pressable, StyleSheet, View } from "react-native";

import { Document24Icon, Trash24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { EmptyState } from "@/components/ui/emptyState";
import { makeThemedStyles, useTheme } from "@/theme";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { useComposerDraftsStore, type ComposerDraft } from "@/store/composerDrafts.store";

export function DraftsButton() {
  const { colors } = useTheme();
  const count = useComposerDraftsStore((s) => s.drafts.length);
  const openDraftsSheet = useComposerDraftsStore((s) => s.openDraftsSheet);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Open drafts, ${count} saved` : "Open drafts"}
      hitSlop={8}
      onPress={openDraftsSheet}
    >
      <Text size={14} weight={600} lineHeight={16.8} color={colors.primary}>
        Drafts{count > 0 ? ` (${count})` : ""}
      </Text>
    </Pressable>
  );
}

export function DraftsSheet({ onResume }: { readonly onResume: (draft: ComposerDraft) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const drafts = useComposerDraftsStore((s) => s.drafts);
  const isOpen = useComposerDraftsStore((s) => s.isDraftsSheetOpen);
  const close = useComposerDraftsStore((s) => s.closeDraftsSheet);
  const deleteDraft = useComposerDraftsStore((s) => s.deleteDraft);
  return (
    <BottomSheet visible={isOpen} onClose={close} title="Drafts" subtitle="Posts and clips you saved for later on this device." scrollable>
      {drafts.length === 0 ? (
        <EmptyState compact title="No drafts yet" body="Start a post or clip, then save it as a draft to finish later." />
      ) : (
        <View style={styles.list}>
          {drafts.map((draft) => (
            <View key={draft.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Resume ${draft.kind} draft from ${formatTimeSincePosted(draft.updatedAt)}`}
                onPress={() => onResume(draft)}
                style={styles.main}
              >
                <Document24Icon size={20} color={colors.textMuted} />
                <View style={styles.kindPill}>
                  <Text size={11} weight={700} lineHeight={14} color={colors.primary}>
                    {draft.kind === "clip" ? "CLIP" : "POST"}
                  </Text>
                </View>
                <View style={styles.texts}>
                  <Text size={14} weight={500} lineHeight={16.8} numberOfLines={2}>
                    {draft.text.trim() ? draft.text : draft.files.length > 0 ? `${draft.files.length} attachment${draft.files.length === 1 ? "" : "s"}` : "Untitled draft"}
                  </Text>
                  <Text size={12} lineHeight={16} color={colors.textMuted}>
                    {formatTimeSincePosted(draft.updatedAt)}
                    {draft.files.length > 0 ? ` · ${draft.files.length} file${draft.files.length === 1 ? "" : "s"}` : ""}
                    {draft.soundId ? " · sound" : ""}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete draft"
                hitSlop={10}
                onPress={() => deleteDraft(draft.id)}
                style={styles.delete}
              >
                <Trash24Icon size={20} color={colors.error} />
                <Text size={13} weight={600} lineHeight={16} color={colors.error}>
                  Delete
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { gap: 4, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  kindPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryTint },
  texts: { flex: 1, gap: 2 },
  delete: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 8 },
}));
