import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MentionText } from "@/components/mentions/mentionText";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MentionEntity } from "@/types/mention.type";

export const FEED_POST_WORD_LIMIT = 40;
export const CLIP_CAPTION_WORD_LIMIT = 20;

export interface ExpandableTextProps {
  readonly text: string;
  readonly mentions?: readonly MentionEntity[];
  readonly wordLimit?: number;
  readonly size?: number;
  readonly lineHeight?: number;
  readonly color?: string;
  readonly mentionColor?: string;
  readonly style?: object;
  readonly expandOnTextPress?: boolean;
}

export function ExpandableText({
  text,
  mentions,
  wordLimit = FEED_POST_WORD_LIMIT,
  size = 14,
  lineHeight = 19.2,
  color,
  mentionColor,
  style,
  expandOnTextPress = false,
}: ExpandableTextProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { visibleText, visibleMentions, truncatable } = useMemo(() => {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= wordLimit) return { visibleText: text, visibleMentions: mentions, truncatable: false };
    const sliced = words.slice(0, wordLimit).join(" ");
    const cutoff = sliced.length;
    return {
      visibleText: `${sliced}…`,
      visibleMentions: mentions?.filter((mention) => mention.start < cutoff),
      truncatable: true,
    };
  }, [text, mentions, wordLimit]);

  const body = (
    <View>
      <MentionText
        text={truncatable && !expanded ? visibleText : text}
        mentions={truncatable && !expanded ? visibleMentions : mentions}
        size={size}
        lineHeight={lineHeight}
        color={color}
        mentionColor={mentionColor}
        style={style}
      />
      {truncatable && !expandOnTextPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Show less" : "Show more"}
          hitSlop={6}
          onPress={() => setExpanded((value) => !value)}
          style={styles.moreHit}
        >
          <Text size={size - 1} weight={600} lineHeight={lineHeight} color={colors.primary}>
            {expanded ? "Show less" : "more"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (truncatable && expandOnTextPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Collapse caption" : "Expand caption"}
        onPress={() => setExpanded((value) => !value)}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({ moreHit: { alignSelf: "flex-start", paddingVertical: 2 } });
