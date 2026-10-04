import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { parseTimestampToSeconds } from "@/services/accountHealth.service";
import { useTheme } from "@/theme";

import { ClaimTextField, useClaimFieldStyles } from "./copyrightClaimFields";

export interface SegmentDraft {
  readonly start: string;
  readonly end: string;
}

const MAXIMUM_SEGMENTS = 5;

export function segmentDraftsToSeconds(drafts: readonly SegmentDraft[]) {
  const segments = drafts
    .filter((draft) => draft.start.trim() !== "" || draft.end.trim() !== "")
    .map((draft) => ({ startSeconds: parseTimestampToSeconds(draft.start), endSeconds: parseTimestampToSeconds(draft.end) }));
  const isValid = segments.every((segment) => segment.startSeconds !== null && segment.endSeconds !== null && segment.endSeconds > segment.startSeconds);
  return { isValid, segments: isValid ? segments.map((segment) => ({ startSeconds: segment.startSeconds ?? 0, endSeconds: segment.endSeconds ?? 0 })) : [] };
}

export function CopyrightSegmentsEditor({ drafts, onChange }: { readonly drafts: readonly SegmentDraft[]; readonly onChange: (drafts: SegmentDraft[]) => void }) {
  const { colors } = useTheme();
  const styles = useClaimFieldStyles();
  const update = (index: number, change: Partial<SegmentDraft>) => onChange(drafts.map((draft, position) => (position === index ? { ...draft, ...change } : draft)));
  return (
    <View style={styles.field}>
      <Text size={13} weight={500} lineHeight={16.9}>
        When does your work appear?
      </Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Use minutes and seconds, for example 0:12 to 0:45.
      </Text>
      {drafts.map((draft, index) => (
        <View key={index} style={styles.segmentRow}>
          <View style={styles.segmentInput}>
            <ClaimTextField label={`Start ${index + 1}`} value={draft.start} onChangeText={(start) => update(index, { start })} placeholder="0:12" keyboardType="numbers-and-punctuation" maximumLength={8} />
          </View>
          <View style={styles.segmentInput}>
            <ClaimTextField label={`End ${index + 1}`} value={draft.end} onChangeText={(end) => update(index, { end })} placeholder="0:45" keyboardType="numbers-and-punctuation" maximumLength={8} />
          </View>
        </View>
      ))}
      {drafts.length < MAXIMUM_SEGMENTS ? (
        <Pressable accessibilityRole="button" onPress={() => onChange([...drafts, { start: "", end: "" }])}>
          <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>
            Add another segment
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
