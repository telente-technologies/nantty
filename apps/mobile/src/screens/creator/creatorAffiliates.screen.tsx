import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { AffiliateProductRow } from "@/components/creator/affiliates/affiliateProductRow";
import {
  affiliatePayoutLabels, describeAffiliateEarning, describeAffiliateReversal, formatConversion, formatMoneyList,
} from "@/components/creator/affiliates/affiliateLabels.util";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/emptyState";
import { Header } from "@/components/ui/header";
import { KeyboardScrollScreen } from "@/components/ui/keyboardAwareForm";
import { TextField } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { affiliatesService } from "@/services/creators/affiliates.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AffiliateEarningStatus } from "@/types/affiliate.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

type Section = "catalog" | "promoting" | "earnings";

const SECTIONS: readonly { readonly key: Section; readonly label: string }[] = [
  { key: "catalog", label: "Can promote" },
  { key: "promoting", label: "Promoting" },
  { key: "earnings", label: "Earnings" },
];

const EARNING_TABS: readonly { readonly key: AffiliateEarningStatus; readonly label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "earned", label: "Earned" },
  { key: "reversed", label: "Reversed" },
];

const stockLabel = (stock: number | null) => (stock === null ? "Stock not tracked" : stock > 0 ? `${stock} in stock` : "Out of stock");

function CatalogSection() {
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const catalog = useInfiniteQuery({
    queryKey: ["affiliates", "catalog", query],
    queryFn: ({ pageParam }) => affiliatesService.listPromotableProducts(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const products = catalog.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <>
      <TextField label="Search products" value={search} onChangeText={setSearch} maxLength={80} autoCorrect={false} />
      {catalog.isPending ? <ListSkeleton /> : null}
      {catalog.isError ? <Text size={13}>{describeActionFailure(catalog.error)}</Text> : null}
      {catalog.isSuccess && products.length === 0 ? <EmptyState title="No products match" body="Check back when more sellers open their products to affiliates." /> : null}
      {products.map((product) => (
        <AffiliateProductRow key={product.productId} productId={product.productId} name={product.name} imageUrl={product.imageUrl} access={product.access} link={product.link}
          details={[
            `${product.store.name} · ${formatMoneyForDisplay(product.price)} · ${stockLabel(product.stock)}`,
            `${product.commissionPercent}% commission, about ${formatMoneyForDisplay(product.estimatedCommission)} per sale`,
            `${product.programme.attributionWindowDays}-day window · ${product.programme.approval === "automatic" ? "auto-approval" : "seller approves"} · paid when the order completes`,
          ]} />
      ))}
      {catalog.hasNextPage ? <Button title="Show more" variant="subtle" loading={catalog.isFetchingNextPage} onPress={() => void catalog.fetchNextPage()} /> : null}
    </>
  );
}

function PromotingSection() {
  const { colors } = useTheme();
  const promotions = useQuery({ queryKey: ["affiliates", "promotions"], queryFn: affiliatesService.listPromotions });
  const rows = promotions.data ?? [];
  if (promotions.isPending) return <ListSkeleton />;
  if (promotions.isError) return <Text size={13}>{describeActionFailure(promotions.error)}</Text>;
  if (rows.length === 0) return <EmptyState title="Nothing promoted yet" body="Copy a link from Can promote, or tag an approved product in a post, clip or live." />;
  const top = rows.filter((row) => row.earned.amountMinor > 0).slice(0, 3);
  return (
    <>
      {top.length > 0 ? <Text size={13} color={colors.textSubtle}>{`Top performers: ${top.map((row) => row.name).join(", ")}`}</Text> : null}
      {rows.map((row) => (
        <AffiliateProductRow key={row.productId} productId={row.productId} name={row.name} imageUrl={row.imageUrl} access={row.access} link={row.link}
          details={[
            `${row.store.name} · ${row.commissionPercent}% commission now`,
            `${row.clicks} clicks · ${row.completedOrders + row.pendingOrders} sales · ${formatConversion(row.conversionPercent)} conversion`,
            `Earned ${formatMoneyForDisplay(row.earned)} · pending ${formatMoneyForDisplay(row.pendingEarnings)} · ${row.reversedOrders} reversed`,
          ]} />
      ))}
    </>
  );
}

function EarningsSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [status, setStatus] = useState<AffiliateEarningStatus>("pending");
  const earnings = useInfiniteQuery({
    queryKey: ["affiliates", "earnings", status],
    queryFn: ({ pageParam }) => affiliatesService.listEarnings(status, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const summary = earnings.data?.pages[0]?.summary;
  const rows = earnings.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <>
      <Text size={13} color={colors.textSubtle}>Commission is paid only when the order completes. Refunds, cancellations and disputes settled before completion pay nothing.</Text>
      {summary ? (
        <View style={styles.card}>
          <Text size={13}>{`Pending ${formatMoneyList(summary.pending)}`}</Text>
          <Text size={13}>{`Earned ${formatMoneyList(summary.earned)} (${formatMoneyList(summary.paid)} in your wallet)`}</Text>
          <Text size={13}>{`Reversed ${formatMoneyList(summary.reversed)}`}</Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        {EARNING_TABS.map((tab) => <Chip key={tab.key} kind="filter" label={tab.label} selected={status === tab.key} onPress={() => setStatus(tab.key)} />)}
      </View>
      {earnings.isPending ? <ListSkeleton /> : null}
      {earnings.isError ? <Text size={13}>{describeActionFailure(earnings.error)}</Text> : null}
      {earnings.isSuccess && rows.length === 0 ? <EmptyState title={`No ${status} commissions`} body="Sales you drive show here." /> : null}
      {rows.map((earning) => (
        <View key={earning.id} style={styles.card}>
          <Text size={14} weight={600} lineHeight={18}>{describeAffiliateEarning(earning)}</Text>
          <Text size={12} color={colors.textSubtle}>{`${earning.commissionPercent}% of ${formatMoneyForDisplay(earning.sale)} · ${earning.status === "reversed" ? describeAffiliateReversal(earning.reason) : affiliatePayoutLabels[earning.payoutStatus]}`}</Text>
          <Text size={14} weight={600}>{earning.status === "reversed" ? `-${formatMoneyForDisplay(earning.reversed)}` : formatMoneyForDisplay(earning.commission)}</Text>
        </View>
      ))}
      {earnings.hasNextPage ? <Button title="Show more" variant="subtle" loading={earnings.isFetchingNextPage} onPress={() => void earnings.fetchNextPage()} /> : null}
    </>
  );
}

export function CreatorAffiliatesScreen(_props: MainScreenProps<"CreatorAffiliates">) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("catalog");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["affiliates"] }).finally(() => setRefreshing(false));
  };
  return (
    <KeyboardScrollScreen
      header={
        <>
          <Header title="Affiliate" />
          <View style={styles.chips}>
            {SECTIONS.map((option) => <Chip key={option.key} kind="filter" label={option.label} selected={section === option.key} onPress={() => setSection(option.key)} />)}
          </View>
        </>
      }
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {section === "catalog" ? <CatalogSection /> : null}
      {section === "promoting" ? <PromotingSection /> : null}
      {section === "earnings" ? <EarningsSection /> : null}
    </KeyboardScrollScreen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 4 },
}));
