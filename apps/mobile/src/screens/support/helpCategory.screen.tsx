import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { helpCenterService } from "@/services/support/helpCenter.service";

export function HelpCategoryScreen({ navigation, route }: MainScreenProps<"HelpCategory">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { categorySlug } = route.params;
  const category = useQuery({ queryKey: ["help", "category", categorySlug], queryFn: () => helpCenterService.fetchHelpCategory(categorySlug) });
  const title = category.data?.category.title ?? route.params.title ?? "Help";
  return (
    <Screen>
      <Header title={title} />
      <FlatList
        data={category.data?.topics ?? []}
        keyExtractor={(topic) => topic.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={category.data ? <Text size={13} lineHeight={18} color={colors.textMuted} style={styles.description}>{category.data.category.description}</Text> : undefined}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => navigation.navigate("HelpArticle", { topicSlug: item.slug })} style={styles.row}>
            <Text size={14} weight={500} lineHeight={16.8}>{item.title}</Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted} numberOfLines={2}>{item.summary}</Text>
            {item.fromResolvedQuestion ? <View><Text size={11} lineHeight={14} color={colors.textSubtle}>{item.sourceLabel}</Text></View> : null}
          </Pressable>
        )}
        ListEmptyComponent={category.isLoading ? <ListSkeleton rows={5} /> : category.isError ? <ErrorState error={category.error} message="Couldn't load this category." onRetry={() => category.refetch()} /> : <Text align="center" color={colors.textSubtle}>No topics here yet.</Text>}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  description: { marginBottom: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4 },
}));
