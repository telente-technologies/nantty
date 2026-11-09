import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { TextField } from "@/components/ui/input";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { sellerService } from "@/services/sellers/seller.service";
import { sellerReturnsService } from "@/services/sellers/sellerReturns.service";
import type { StoreLocation } from "@/types/sellerCatalog.type";
import type { SellerReturnRequest, SellerReturnStatus } from "@/types/sellerReturns.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { makeThemedStyles, useTheme } from "@/theme";
import { spacing } from "@/constants/spacing.constant";

const PAGE_SIZE = 25;

const RETURN_FILTERS: readonly { readonly key: SellerReturnStatus | null; readonly label: string }[] = [
  { key: null, label: "All" },
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "refunded", label: "Refunded" },
];

function returnStatusLabel(status: SellerReturnStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function SellerReturnsSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SellerReturnStatus | null>(null);
  const [decliningReturn, setDecliningReturn] = useState<SellerReturnRequest | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [receivingReturn, setReceivingReturn] = useState<SellerReturnRequest | null>(null);
  const [restock, setRestock] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const returns = useInfiniteQuery({
    queryKey: sellerQueryKeys.returnsPage(status),
    queryFn: ({ pageParam }) => sellerReturnsService.listStoreReturns({ cursor: pageParam, status, limit: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor || undefined,
  });
  const locations = useQuery({
    queryKey: sellerQueryKeys.locations,
    queryFn: sellerService.listMyStoreLocations,
    enabled: receivingReturn !== null && restock,
  });

  const afterAction = async () => {
    setActionError(null);
    setDecliningReturn(null);
    setDeclineNote("");
    setReceivingReturn(null);
    setRestock(false);
    setLocationId(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.returns }),
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders }),
    ]);
  };
  const onActionError = (error: unknown) => setActionError(describeActionFailure(error, "Couldn't update this return request. Check the latest status and try again."));

  const approve = useMutation({ mutationFn: sellerReturnsService.approveStoreReturn, onSuccess: afterAction, onError: onActionError });
  const decline = useMutation({
    mutationFn: ({ returnId, note }: { readonly returnId: string; readonly note: string }) => sellerReturnsService.declineStoreReturn(returnId, { note }),
    onSuccess: afterAction,
  });
  const receive = useMutation({
    mutationFn: ({ returnId, restockItems, restockLocationId }: { readonly returnId: string; readonly restockItems: boolean; readonly restockLocationId: string | null }) =>
      sellerReturnsService.receiveStoreReturn(returnId, { restock: restockItems, locationId: restockItems ? restockLocationId : null }),
    onSuccess: afterAction,
  });

  const entries = (returns.data?.pages ?? []).flatMap((page) => page.data);
  const activeLocations = (locations.data ?? []).filter((location) => location.active);
  const busy = approve.isPending || decline.isPending || receive.isPending;
  const declineText = declineNote.trim();
  const canDecline = declineText.length >= 5 && declineText.length <= 500;
  const canReceive = !restock || (!!locationId && activeLocations.some((location) => location.id === locationId));

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersBar} contentContainerStyle={styles.filters} accessibilityLabel="Filter return requests">
        {RETURN_FILTERS.map((option) => (
          <Chip key={option.key ?? "all"} kind="filter" label={option.label} selected={status === option.key} onPress={() => setStatus(option.key)} />
        ))}
      </ScrollView>
      {actionError ? <Text style={styles.actionError} size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">{actionError}</Text> : null}
      <FlatList
        testID="seller-returns-list"
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={returns.isRefetching && !returns.isFetchingNextPage}
        onRefresh={() => { void returns.refetch(); }}
        onEndReached={() => {
          if (returns.hasNextPage && !returns.isFetchingNextPage) void returns.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <SellerReturnCard
            item={item}
            busy={busy}
            onApprove={() => { setActionError(null); approve.mutate(item.id); }}
            onDecline={() => { setActionError(null); decline.reset(); setDeclineNote(""); setDecliningReturn(item); }}
            onReceive={() => { setActionError(null); receive.reset(); setRestock(false); setLocationId(null); setReceivingReturn(item); }}
          />
        )}
        ListEmptyComponent={
          returns.isLoading ? (
            <ListSkeleton rows={4} avatarSize={48} padding={4} />
          ) : returns.isError ? (
            <ErrorState error={returns.error} compact message="Couldn't load return requests." onRetry={() => { void returns.refetch(); }} retrying={returns.isRefetching} />
          ) : (
            <EmptyState compact title={status ? `No ${returnStatusLabel(status).toLowerCase()} return requests` : "No return requests"} body="Buyer return requests for this store will appear here." />
          )
        }
        ListFooterComponent={returns.isFetchingNextPage ? <BrandLoader size="sm" style={styles.footer} /> : undefined}
      />

      <BottomSheet visible={decliningReturn !== null} onClose={() => setDecliningReturn(null)} title="Decline return request" scrollable>
        <View style={styles.sheetBody}>
          <Text size={13} lineHeight={18} color={colors.textMuted}>Add a note explaining why this return cannot be accepted.</Text>
          <TextField
            label="Note"
            placeholder="Write at least 5 characters"
            value={declineNote}
            onChangeText={setDeclineNote}
            multiline
            maxLength={500}
            textAlignVertical="top"
            accessibilityLabel="Decline reason, required"
            style={styles.noteField}
            boxStyle={styles.noteBox}
          />
          <Text size={12} lineHeight={16} color={colors.textMuted} accessibilityLiveRegion="polite">{declineText.length}/500</Text>
          {decline.isError ? <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">{describeActionFailure(decline.error)}</Text> : null}
          <Button
            title="Decline request"
            variant="danger"
            disabled={!canDecline || !decliningReturn}
            loading={decline.isPending}
            onPress={() => decliningReturn && decline.mutate({ returnId: decliningReturn.id, note: declineText })}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={receivingReturn !== null} onClose={() => setReceivingReturn(null)} title="Receive returned items" scrollable>
        <View style={styles.sheetBody}>
          <Text size={13} lineHeight={18} color={colors.textMuted}>Confirm receipt of the return. The backend will process the refund after this action.</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: restock }}
            onPress={() => { setRestock((value) => !value); setLocationId(null); }}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, restock && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {restock ? <Text size={12} weight={700} lineHeight={14} color={colors.onPrimary} accessibilityElementsHidden>✓</Text> : null}
            </View>
            <Text size={14} lineHeight={19}>Restock returned items</Text>
          </Pressable>
          {restock ? (
            locations.isLoading ? <ListSkeleton rows={2} avatarSize={0} padding={2} /> : locations.isError ? (
              <ErrorState error={locations.error} compact message="Couldn't load store locations." onRetry={() => { void locations.refetch(); }} retrying={locations.isRefetching} />
            ) : activeLocations.length === 0 ? (
              <Text size={13} lineHeight={18} color={colors.textMuted} accessibilityRole="alert">There are no active store locations to restock into. Turn off restocking or add a location first.</Text>
            ) : (
              <View style={styles.locations}>
                <Text size={13} weight={600} lineHeight={18} accessibilityRole="header">Restock location</Text>
                {activeLocations.map((location) => <LocationOption key={location.id} location={location} selected={location.id === locationId} onPress={() => setLocationId(location.id)} />)}
              </View>
            )
          ) : null}
          {receive.isError ? <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">{describeActionFailure(receive.error)}</Text> : null}
          <Button
            title="Confirm received"
            disabled={!receivingReturn || !canReceive || (restock && (locations.isLoading || locations.isError || activeLocations.length === 0))}
            loading={receive.isPending}
            onPress={() => receivingReturn && receive.mutate({ returnId: receivingReturn.id, restockItems: restock, restockLocationId: locationId })}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function SellerReturnCard({ item, busy, onApprove, onDecline, onReceive }: {
  readonly item: SellerReturnRequest;
  readonly busy: boolean;
  readonly onApprove: () => void;
  readonly onDecline: () => void;
  readonly onReceive: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardTitle}>
          <Text size={15} weight={600} lineHeight={20} accessibilityRole="header">Order {item.orderNumber}</Text>
          <Text size={13} lineHeight={18} color={colors.textMuted}>Buyer: {item.buyerName}</Text>
        </View>
        <Text size={12} weight={600} lineHeight={16} color={colors.primary} accessibilityLabel={`Status: ${returnStatusLabel(item.status)}`}>{returnStatusLabel(item.status)}</Text>
      </View>
      <Text size={12} lineHeight={16} color={colors.textMuted}>{formatFriendlyDate(item.createdAt)}</Text>
      <View style={styles.lines}>
        {item.lines.map((line) => <Text key={line.orderLineId} size={13} lineHeight={18}>{line.quantity} × {line.name}</Text>)}
      </View>
      <View style={styles.reason}>
        <Text size={12} weight={600} lineHeight={16} color={colors.textMuted}>Reason</Text>
        <Text size={13} lineHeight={18}>{item.reason}</Text>
      </View>
      <View style={styles.refundRow}>
        <Text size={13} lineHeight={18} color={colors.textMuted}>Refund amount</Text>
        <Text size={14} weight={600} lineHeight={19}>{formatMoneyForDisplay(item.refundAmount)}</Text>
      </View>
      {item.status === "declined" && item.declineNote ? (
        <Text size={13} lineHeight={18} color={colors.textMuted} accessibilityLabel={`Decline note: ${item.declineNote}`}>Seller note: {item.declineNote}</Text>
      ) : null}
      {item.status === "requested" ? (
        <View style={styles.actions}>
          <Button title="Approve" variant="primary" disabled={busy} loading={busy} onPress={onApprove} style={styles.actionButton} />
          <Button title="Decline" variant="subtle" disabled={busy} onPress={onDecline} style={styles.actionButton} />
        </View>
      ) : item.status === "approved" ? (
        <Button title="Receive returned items" variant="outline" disabled={busy} onPress={onReceive} />
      ) : null}
    </View>
  );
}

function LocationOption({ location, selected, onPress }: { readonly location: StoreLocation; readonly selected: boolean; readonly onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.locationOption, selected && styles.locationOptionSelected]}>
      <View style={[styles.radio, selected && { borderColor: colors.primary }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
      <Text size={14} lineHeight={18}>{location.name}</Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1 },
  filtersBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  list: { paddingHorizontal: spacing[3], paddingBottom: spacing[8], flexGrow: 1 },
  separator: { height: spacing[3] },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[3] },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing[3] },
  cardTitle: { flex: 1, gap: spacing[1] },
  lines: { gap: spacing[1] },
  reason: { gap: spacing[1], paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  refundRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  actions: { flexDirection: "row", gap: spacing[2] },
  actionButton: { flex: 1 },
  actionError: { paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  footer: { paddingVertical: spacing[6] },
  sheetBody: { gap: spacing[3], paddingBottom: spacing[2] },
  noteField: { minHeight: 92 },
  noteBox: { minHeight: 92, height: undefined, alignItems: "flex-start", paddingVertical: spacing[2] },
  checkboxRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing[3] },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: colors.textSubtle, alignItems: "center", justifyContent: "center" },
  locations: { gap: spacing[2] },
  locationOption: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[3], borderWidth: 1, borderColor: colors.divider, borderRadius: 8 },
  locationOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.textSubtle, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
}));
