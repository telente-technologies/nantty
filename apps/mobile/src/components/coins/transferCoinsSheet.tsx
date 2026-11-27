import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SealCheck20Icon, Wallet24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { coinsService } from "@/services/money/coins.service";
import { useAuthStore } from "@/store/auth.store";
import { isDefinitiveCoinTransferRejection, isCoinTransferFeeChanged } from "./coinTransferRetry.util";
import { clearPendingCoinTransfer, readPendingCoinTransfer, savePendingCoinTransfer, type PendingCoinTransfer } from "./pendingCoinTransfer.service";
import type { UserSummary } from "@/types";

import { CoinBalanceChip } from "./coinBalanceChip";
import { COIN_BALANCE_QUERY_KEY, describeCoinError, formatCoinAmount, useCoinBalance } from "./coinWallet.hook";

export interface TransferCoinsSheetProps {
  readonly visible: boolean;
  readonly recipient: UserSummary | null;
  readonly onClose: () => void;
}

export function TransferCoinsSheet({ visible, recipient, onClose }: TransferCoinsSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const [typedCoins, setTypedCoins] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [restoredAccountId, setRestoredAccountId] = useState<string | null>(null);
  const [intentReadFailed, setIntentReadFailed] = useState(false);
  const [isRetryingIntentRead, setIsRetryingIntentRead] = useState(false);
  const [intentReadAttempt, setIntentReadAttempt] = useState(0);
  const [pendingTransfer, setPendingTransfer] = useState<PendingCoinTransfer | null>(null);
  const [settledIntentCleanupFailed, setSettledIntentCleanupFailed] = useState(false);
  const balance = useCoinBalance(visible);
  const isIntentReady = accountId !== null && restoredAccountId === accountId && !intentReadFailed && !isRetryingIntentRead;
  const activePendingTransfer = pendingTransfer?.accountId === accountId ? pendingTransfer : null;
  const visibleTypedCoins = restoredAccountId === accountId ? typedCoins : "";
  const coins = Number.parseInt(visibleTypedCoins, 10);
  const hasValidAmount = Number.isInteger(coins) && coins > 0 && coins <= (balance.data?.coins ?? 0);
  const quote = useQuery({
    queryKey: ["coin-transfer-quote", coins],
    queryFn: () => coinsService.fetchCoinTransferQuote(coins),
    enabled: isIntentReady && visible && hasValidAmount,
    staleTime: 60_000,
  });

  const transfer = useMutation({
    mutationFn: async () => {
      let attempt = activePendingTransfer;
      if (!attempt) {
        if (!isIntentReady) throw new Error("Secure transfer recovery is still loading.");
        if (intentReadFailed) throw new Error("We couldn't securely check for an earlier transfer. Try again before sending coins.");
        if (!recipient || !quote.data) throw new Error("Refresh the transfer quote before confirming.");
        attempt = {
          accountId,
          idempotencyKey: generateIdempotencyKey(),
          recipientUserId: recipient.id,
          coins,
          feeBasisPoints: quote.data.feeBasisPoints,
          feeCoins: quote.data.feeCoins,
          netCoins: quote.data.netCoins,
        };
        await savePendingCoinTransfer(attempt);
        setPendingTransfer(attempt);
      }
      if (!attempt || attempt.accountId !== accountId || attempt.recipientUserId !== recipient?.id) {
        throw new Error("Return to the original account and recipient to safely resolve this transfer.");
      }
      return coinsService.transferCoinsToUser(attempt.recipientUserId, attempt.coins, attempt.feeBasisPoints, attempt.idempotencyKey);
    },
    onSuccess: async () => {
      try {
        if (accountId) await clearPendingCoinTransfer(accountId);
        setPendingTransfer(null);
        setSettledIntentCleanupFailed(false);
      } catch {
        // Retain the durable idempotency key until secure storage confirms removal.
        setSettledIntentCleanupFailed(true);
      }
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
    },
    onError: async (error) => {
      setIsConfirming(false);
      if (isCoinTransferFeeChanged(error)) {
        try {
          if (accountId) await clearPendingCoinTransfer(accountId);
          setPendingTransfer(null);
          void queryClient.invalidateQueries({ queryKey: ["coin-transfer-quote", coins] });
        } catch {
          // Keep the request locked rather than risk replacing its persisted key.
        }
      } else if (isDefinitiveCoinTransferRejection(error)) {
        try {
          if (accountId) await clearPendingCoinTransfer(accountId);
          setPendingTransfer(null);
        } catch {
          // Keep the request locked rather than risk replacing its persisted key.
        }
      } else {
        setIsConfirming(true);
      }
    },
  });
  const resetTransfer = transfer.reset;

  useEffect(() => {
    let cancelled = false;
    if (!accountId) return () => { cancelled = true; };
    readPendingCoinTransfer(accountId).then((attempt) => {
      if (cancelled) return;
      setPendingTransfer(attempt);
      setIntentReadFailed(false);
      setIsRetryingIntentRead(false);
      resetTransfer();
      if (attempt) {
        setTypedCoins(String(attempt.coins));
        setIsConfirming(true);
      } else {
        setTypedCoins("");
        setIsConfirming(false);
      }
      setRestoredAccountId(accountId);
    }).catch(() => {
      if (cancelled) return;
      setIntentReadFailed(true);
      setIsRetryingIntentRead(false);
      setRestoredAccountId(accountId);
      resetTransfer();
    });
    return () => { cancelled = true; };
  }, [accountId, intentReadAttempt, resetTransfer]);

  const closeAndReset = () => {
    if (!activePendingTransfer && !transfer.isPending) {
      setTypedCoins("");
      setIsConfirming(false);
      transfer.reset();
    }
    onClose();
  };

  const hasPendingTransfer = activePendingTransfer !== null;
  const retryingUncertainTransfer = hasPendingTransfer && !transfer.isPending && !transfer.isSuccess;
  const pendingMatchesCurrentUser = activePendingTransfer?.accountId === accountId;
  const pendingMatchesRecipient = activePendingTransfer?.recipientUserId === recipient?.id;
  const displayQuote = activePendingTransfer
    ? {
        coins: activePendingTransfer.coins,
        feeCoins: activePendingTransfer.feeCoins,
        netCoins: activePendingTransfer.netCoins,
        feeBasisPoints: activePendingTransfer.feeBasisPoints,
        feePercent: activePendingTransfer.feeBasisPoints / 100,
      }
    : quote.data;

  return (
    <BottomSheet visible={visible} onClose={closeAndReset} title={`Send coins to ${recipient?.name ?? ""}`} floating scrollable>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          {transfer.isSuccess ? <SealCheck20Icon size={22} color={colors.textMuted} /> : <Wallet24Icon size={22} color={colors.textMuted} />}
        </View>
        <CoinBalanceChip />
        {transfer.isSuccess ? (
          <>
            <Text size={14} lineHeight={16.8} color={colors.success} accessibilityLiveRegion="polite">
              Sent. {recipient?.name} received {formatCoinAmount(transfer.data.netCoins)}.
            </Text>
            {settledIntentCleanupFailed ? (
              <View style={styles.recoveryNotice}>
                <Text size={12} lineHeight={16.8} color={colors.error}>
                  The transfer is complete, but secure retry data could not be cleared. Keep this screen open and retry cleanup before starting another transfer.
                </Text>
                <Button title="Retry secure cleanup" onPress={async () => {
                  if (!accountId) return;
                  try {
                    await clearPendingCoinTransfer(accountId);
                    setPendingTransfer(null);
                    setSettledIntentCleanupFailed(false);
                    setIsConfirming(false);
                    transfer.reset();
                  } catch {
                    setSettledIntentCleanupFailed(true);
                  }
                }} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <TextField
              label="Coins to send"
              value={visibleTypedCoins}
              editable={!hasPendingTransfer && !transfer.isPending && isIntentReady}
              onChangeText={(text) => {
                setTypedCoins(text.replace(/[^0-9]/g, "").slice(0, 7));
                setIsConfirming(false);
              }}
              keyboardType="number-pad"
            />
            {displayQuote && (pendingMatchesRecipient || !hasPendingTransfer) ? (
              <View style={styles.quote} accessibilityLabel={`Platform fee ${displayQuote.feeCoins} coins. ${recipient?.name} receives ${displayQuote.netCoins} coins`}>
                <Text size={13} lineHeight={16.9} color={colors.textMuted}>
                  Platform fee ({displayQuote.feePercent}%): {formatCoinAmount(displayQuote.feeCoins)}
                </Text>
                <Text size={14} weight={600} lineHeight={16.8}>
                  {recipient?.name} receives {formatCoinAmount(displayQuote.netCoins)}
                </Text>
              </View>
            ) : null}
            {intentReadFailed ? (
              <View style={styles.recoveryNotice}>
                <Text size={12} lineHeight={16.8} color={colors.error}>
                  We couldn&apos;t securely check whether a previous transfer is waiting. No new transfer can be started until this is resolved.
                </Text>
                <Button title="Check secure recovery again" disabled={isRetryingIntentRead} onPress={() => {
                  setRestoredAccountId(null);
                  setIntentReadFailed(false);
                  setIsRetryingIntentRead(true);
                  setIntentReadAttempt((attempt) => attempt + 1);
                }} />
              </View>
            ) : null}
            {retryingUncertainTransfer && !pendingMatchesRecipient ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>
                A transfer to another recipient is unresolved. Return to that recipient&apos;s profile to safely check its status before sending more coins.
              </Text>
            ) : null}
            {visibleTypedCoins && !hasValidAmount && !hasPendingTransfer ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>
                Enter an amount up to your balance.
              </Text>
            ) : null}
            {retryingUncertainTransfer ? (
              <Text size={12} lineHeight={16.8} color={colors.error} accessibilityLiveRegion="polite">
                We couldn&apos;t confirm whether this transfer completed. Retry the same transfer safely.{transfer.isError ? ` ${describeCoinError(transfer.error)}` : ""}
              </Text>
            ) : transfer.isError ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>
                {describeCoinError(transfer.error)}
              </Text>
            ) : null}
            <Button
              title={retryingUncertainTransfer ? "Retry same transfer" : isConfirming ? `Confirm: send ${formatCoinAmount(coins)}` : "Review transfer"}
              disabled={intentReadFailed || (retryingUncertainTransfer
                ? !pendingMatchesCurrentUser || !pendingMatchesRecipient
                : !isIntentReady || !hasValidAmount || !quote.data || !recipient)}
              loading={transfer.isPending}
              onPress={() => (retryingUncertainTransfer || isConfirming ? transfer.mutate() : setIsConfirming(true))}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingBottom: 4, gap: 12 },
  quote: { gap: 4, padding: 12, borderRadius: 8, backgroundColor: colors.background },
  recoveryNotice: { gap: 8 },
}));
