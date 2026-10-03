import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet } from "react-native";

import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { helpCenterService } from "@/services/helpCenter.service";
import { requireAuthThen } from "@/utils/requireAuth.util";

const SEARCH_DEBOUNCE_MS = 300;

export function HelpCenterScreen({ navigation }: MainScreenProps<"HelpCenter">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [typedQuery, setTypedQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(typedQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typedQuery]);
  const articles = useQuery({ queryKey: ["help", "articles", searchTerm], queryFn: () => helpCenterService.searchHelpArticles(searchTerm) });

  return (
    <Screen>
      <Header title="Help centre" />
      <FlatList
        data={articles.data ?? []}
        keyExtractor={(article) => article.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<TextField label="Search help" placeholder="e.g. refund, username, checkmark" value={typedQuery} onChangeText={setTypedQuery} autoCapitalize="none" />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => navigation.navigate("HelpArticle", { articleId: item.id })} style={styles.row}>
            <Text size={12} lineHeight={14.4} color={colors.textSubtle}>{item.topic}</Text>
            <Text size={14} weight={500} lineHeight={16.8}>{item.title}</Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>{item.summary}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          articles.isLoading ? <ListSkeleton rows={4} />
            : articles.isError ? <ErrorState message="Couldn't load help articles." onRetry={() => articles.refetch()} />
            : <Text align="center" color={colors.textSubtle}>No articles match your search.</Text>
        }
        ListFooterComponent={
          <Text size={14} weight={500} color={colors.primary} align="center" accessibilityRole="link" style={styles.footer} onPress={() => requireAuthThen(() => navigation.navigate("NewSupportTicket"), undefined, "contact support")}>
            Can't find an answer? Contact support
          </Text>
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4 },
  footer: { marginTop: 16 },
}));
