import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";

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
            {article.data.body.split("\n\n").map((paragraph, index) => {
              const [firstLine = "", ...rest] = paragraph.split("\n");
              const hasHeading = rest.length > 0 && !firstLine.endsWith(".");
              return (
                <View key={index} style={styles.paragraph}>
                  {hasHeading ? <Text size={15} weight={600} lineHeight={20} accessibilityRole="header">{firstLine}</Text> : null}
                  <Text size={14} lineHeight={21}>{hasHeading ? rest.join("\n") : paragraph}</Text>
                </View>
              );
            })}
            <Button variant="subtle" title="Still need help? Contact support" onPress={() => requireAuthThen(() => navigation.navigate("NewSupportTicket"), undefined, "contact support")} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 14 }, paragraph: { gap: 4 } });
