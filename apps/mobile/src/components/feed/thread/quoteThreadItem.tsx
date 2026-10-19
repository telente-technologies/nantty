import { Pressable, StyleSheet, View } from "react-native";

import { Quotes24Icon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { useTheme } from "@/theme";
import type { CommentSectionFilter, QuoteThreadItem } from "@/types/postThread.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

export const QUOTED_THIS_POST_LABEL = "Quoted this post";

export function QuoteThreadItemRow({ item, onOpen }: { readonly item: QuoteThreadItem; readonly onOpen: (quotePostId: string) => void }) {
  const { colors } = useTheme();
  const open = () => onOpen(item.id);
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${item.quotePost.author.name} quoted this post. Open their post`} onPress={open} style={styles.label} hitSlop={6}>
        <Quotes24Icon size={14} color={colors.textMuted} />
        <Text size={12} weight={500} lineHeight={16} color={colors.textMuted}>
          {QUOTED_THIS_POST_LABEL}
        </Text>
      </Pressable>
      <QuotedPostCard compact quoted={item.quotePost} onPress={open} />
    </View>
  );
}

export function hasQuotesToShow(quoteCount: number | undefined): boolean {
  return (quoteCount ?? 0) > 0;
}

export function CommentSectionFilterTabs({ filter, onChange, quoteCount }: { readonly filter: CommentSectionFilter; readonly onChange: (filter: CommentSectionFilter) => void; readonly quoteCount?: number }) {
  if (!hasQuotesToShow(quoteCount)) return null;
  const quotesLabel = `Quotes (${formatCountWithThousandsSuffix(quoteCount ?? 0)})`;
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      <Chip kind="filter" label="Replies" selected={filter === "all"} onPress={() => onChange("all")} />
      <Chip kind="filter" label={quotesLabel} selected={filter === "quotes"} onPress={() => onChange("quotes")} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  label: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 24 },
  tabs: { flexDirection: "row", gap: 8, paddingVertical: 8 },
});
