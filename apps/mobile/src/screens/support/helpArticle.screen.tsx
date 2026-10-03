import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { helpCenterService } from "@/services/helpCenter.service";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function HelpArticleScreen({ navigation, route }: MainScreenProps<"HelpArticle">) {
  const { colors } = useTheme();
  const { articleId } = route.params;
  const article = useQuery({ queryKey: ["help", "article", articleId], queryFn: () => helpCenterService.fetchHelpArticle(articleId) });

  return (
    <Screen>
      <Header title="Help" />
      <ScrollView contentContainerStyle={styles.content}>
        {article.isLoading ? <ListSkeleton rows={3} /> : null}
        {article.isError ? <ErrorState message="Couldn't load this article." onRetry={() => article.refetch()} /> : null}
        {article.data ? (
          <>
            <Text size={12} lineHeight={14.4} color={colors.textSubtle}>{article.data.topic}</Text>
            <Text size={20} weight={600} lineHeight={24} accessibilityRole="header">{article.data.title}</Text>
            <Text size={14} lineHeight={21}>{article.data.body}</Text>
            <Button variant="subtle" title="Still need help? Contact support" onPress={() => requireAuthThen(() => navigation.navigate("NewSupportTicket"), undefined, "contact support")} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 14 } });
