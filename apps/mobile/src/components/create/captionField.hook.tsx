import { useRef, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MentionEntity } from "@/types/mention.type";

export interface CaptionFieldOptions {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly onChange: (text: string, mentions: readonly MentionEntity[]) => void;
  readonly placeholder: string;
  readonly minHeight?: number;
}

export function useCaptionField({ text, mentions, onChange, placeholder, minHeight = 120 }: CaptionFieldOptions) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({ surface: "post", text, mentions, inputRef, signInReason: "post", onChange });
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
        maxLength={2000}
        accessibilityLabel={placeholder}
        accessibilityHint="Type @ to mention someone or # to add a hashtag"
        style={[styles.input, { minHeight }]}
      />
      <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
    </>
  );
  const suggestions = mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null;
  return { input, suggestions, focused };
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
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
