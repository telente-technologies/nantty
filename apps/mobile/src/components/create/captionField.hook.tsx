import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import { Text } from "@/components/ui/text";
import type { MentionEntity } from "@/types/mention.type";

export const FREE_POST_TEXT_LIMIT = 280;
export const PREMIUM_POST_TEXT_LIMIT = 2000;

export interface CaptionFieldOptions {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly onChange: (text: string, mentions: readonly MentionEntity[]) => void;
  readonly placeholder: string;
  readonly minHeight?: number;
  readonly maxLength?: number;
  readonly showCount?: boolean;
}

export function useCaptionField({ text, mentions, onChange, placeholder, minHeight = 120, maxLength = PREMIUM_POST_TEXT_LIMIT, showCount = false }: CaptionFieldOptions) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({ surface: "post", text, mentions, inputRef, signInReason: "post", onChange });
  const overLimit = text.length > maxLength;
  const input = (
    <>
      <TextInput
        ref={inputRef}
        {...mentionComposer.inputProps}
        onFocus={() => {
          mentionComposer.inputProps.onFocus();
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholderText}
        selectionColor={colors.primary}
        multiline
        autoFocus={false}
        maxLength={maxLength}
        accessibilityLabel={placeholder}
        accessibilityHint="Type @ to mention someone or # to add a hashtag"
        style={[styles.input, { minHeight }]}
      />
      <View style={styles.meta}>
        <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
        {showCount ? (
          <Text size={12} lineHeight={16} color={overLimit ? colors.error : text.length >= maxLength * 0.9 ? colors.cautionText : colors.textMuted}>
            {text.length}/{maxLength}
          </Text>
        ) : null}
      </View>
    </>
  );
  const suggestions = mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null;
  return { input, suggestions, focused, overLimit };
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: {
    padding: 0,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 16,
    lineHeight: 19.2,
    letterSpacing: calculateDefaultLetterSpacing(16),
    color: colors.text,
  },
}));
