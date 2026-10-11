import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { CaretRight24Icon, Headset24Icon } from "@/components/icons";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useSupportUnreadCount } from "@/hooks/useSupportUnread.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { helpCenterService } from "@/services/support/helpCenter.service";
import type { HelpCategory, HelpTopicSummary } from "@/types/helpCentre.type";
import { requireAuthThen } from "@/utils/requireAuth.util";

const SEARCH_DEBOUNCE_MS = 300;

type HelpRow = { readonly kind: "category"; readonly category: HelpCategory } | { readonly kind: "topic"; readonly topic: HelpTopicSummary };

export function HelpCenterScreen({ navigation }: MainScreenProps<"HelpCenter">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const unreadReplies = useSupportUnreadCount();
  const [typedQuery, setTypedQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(typedQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typedQuery]);
  const categories = useQuery({ queryKey: ["help", "categories"], queryFn: helpCenterService.fetchHelpCategories });
  const results = useQuery({ queryKey: ["help", "search", searchTerm], queryFn: () => helpCenterService.searchHelpTopics(searchTerm), enabled: searchTerm.length > 0 });
  const isSearching = searchTerm.length > 0;
  const activeQuery = isSearching ? results : categories;
  const rows: HelpRow[] = isSearching
    ? (results.data?.items ?? []).map((topic) => ({ kind: "topic", topic }))
    : (categories.data?.items ?? []).map((category) => ({ kind: "category", category }));

  return (
    <Screen>
      <Header title="Help centre" />
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "category" ? `c:${row.category.id}` : `t:${row.topic.id}`)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField label="Search help" placeholder="e.g. refund, username, checkmark" value={typedQuery} onChangeText={setTypedQuery} autoCapitalize="none" returnKeyType="search" />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Contact support" onPress={() => requireAuthThen(() => navigation.navigate("NewSupportTicket"), undefined, "contact support")} style={styles.actionCard}>
                <Headset24Icon size={22} color={colors.primary} />
                <Text size={14} weight={500}>Contact support</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={unreadReplies > 0 ? `My requests, ${unreadReplies} unread replies` : "My requests"} onPress={() => requireAuthThen(() => navigation.navigate("SupportTickets"), undefined, "see your requests")} style={styles.actionCard}>
                <Text size={14} weight={500}>My requests</Text>
                {unreadReplies > 0 ? <View style={styles.badge}><Text size={11} weight={600} color={colors.white}>{unreadReplies > 99 ? "99+" : unreadReplies}</Text></View> : null}
              </Pressable>
            </View>
            <Text size={13} weight={600} color={colors.textSubtle}>{isSearching ? "Results" : "Browse topics"}</Text>
          </View>
        }
        renderItem={({ item }) => item.kind === "category" ? (
          <Pressable accessibilityRole="button" accessibilityLabel={item.category.title} onPress={() => navigation.navigate("HelpCategory", { categorySlug: item.category.slug, title: item.category.title })} style={styles.row}>
            <View style={styles.flex}>
              <Text size={15} weight={500} lineHeight={18}>{item.category.title}</Text>
              <Text size={13} lineHeight={17} color={colors.textMuted} numberOfLines={2}>{item.category.description}</Text>
            </View>
            <CaretRight24Icon size={18} color={colors.textSubtle} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={item.topic.title} onPress={() => navigation.navigate("HelpArticle", { topicSlug: item.topic.slug })} style={styles.row}>
            <View style={styles.flex}>
              <Text size={12} lineHeight={14.4} color={colors.textSubtle}>{item.topic.categoryTitle}</Text>
              <Text size={14} weight={500} lineHeight={16.8}>{item.topic.title}</Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted} numberOfLines={2}>{item.topic.summary}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          activeQuery.isLoading ? <ListSkeleton rows={5} />
            : activeQuery.isError ? <ErrorState error={activeQuery.error} message="Couldn't load the help centre." onRetry={() => activeQuery.refetch()} />
            : <Text align="center" color={colors.textSubtle}>{isSearching ? "No topics match your search. Try other words or contact support." : "No help topics yet."}</Text>
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  header: { gap: 12, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 8 },
  actionCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 14, minHeight: 52 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.error },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  flex: { flex: 1, gap: 4 },
}));
