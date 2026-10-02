import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { AffiliationsSection } from "@/components/creator/affiliationsSection";
import { CreatorEarningsCard } from "@/components/creator/creatorEarningsCard";
import { creatorQueryKeys, useCreatorRevenueRulesQuery } from "@/components/creator/creatorQueries.hook";
import { RevenueRulesCard } from "@/components/creator/revenueRulesCard";
import { SubscriptionPlansSection } from "@/components/creator/subscriptionPlansSection";
import { Analytics24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { creatorProgramService } from "@/services/creatorProgram.service";
import type { CreatorDashboardPeriod } from "@/types/creator.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const PERIODS: readonly { readonly key: CreatorDashboardPeriod; readonly label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

export function CreatorDashboardScreen({ navigation }: MainScreenProps<"CreatorDashboard">) {
  const [period, setPeriod] = useState<CreatorDashboardPeriod>("month");
  const dashboard = useQuery({ queryKey: creatorQueryKeys.dashboard(period), queryFn: () => creatorProgramService.fetchCreatorDashboard(period) });
  const revenueRules = useCreatorRevenueRulesQuery();

  return (
    <Screen>
      <Header title="Creator dashboard" />
      <View style={styles.periods}>
        {PERIODS.map((option) => (
          <Chip key={option.key} kind="filter" label={option.label} selected={period === option.key} onPress={() => setPeriod(option.key)} />
        ))}
      </View>
      {!dashboard.data ? (
        dashboard.isError ? (
          <View style={styles.state}>
            <Text align="center" color={colors.textSubtle}>{dashboard.error.message}</Text>
            <Button title="See the Creator Program" onPress={() => navigation.replace("CreatorProgram")} />
          </View>
        ) : <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} tintColor={colors.primary} />}
        >
          <CreatorEarningsCard dashboard={dashboard.data} />
          <Button title="Withdraw earnings" onPress={() => navigation.navigate("Wallet")} />
          <View style={styles.card}>
            <Text size={16} weight={600} lineHeight={19.2}>Top lives & posts</Text>
            {dashboard.data.topContent.map((content) => (
              <Pressable
                key={content.id}
                style={styles.row}
                accessibilityRole={content.kind === "post" ? "button" : undefined}
                onPress={content.kind === "post" ? () => navigation.navigate("PostAnalytics", { postId: content.id }) : undefined}
              >
                <Image source={{ uri: content.thumbnailUrl ?? undefined }} style={styles.thumb} contentFit="cover" />
                <View style={styles.flex}>
                  <Text size={14} lineHeight={16.8} numberOfLines={1}>{content.title}</Text>
                  <View style={styles.metrics}>
                    <Analytics24Icon size={12} color={colors.textSubtle} />
                    <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
                      {content.kind === "live" ? "Live" : "Post"} · {formatCountWithThousandsSuffix(content.views)} views
                    </Text>
                  </View>
                </View>
                <Text size={13} weight={500} lineHeight={16.9}>{formatMoneyForDisplay(content.earnings)}</Text>
              </Pressable>
            ))}
          </View>
          <AffiliationsSection />
          <SubscriptionPlansSection />
          {revenueRules.data ? <RevenueRulesCard rules={revenueRules.data} /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  periods: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  loading: { marginTop: 80 },
  state: { padding: 32, gap: 16 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  metrics: { flexDirection: "row", alignItems: "center", gap: 4 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.placeholder },
});
