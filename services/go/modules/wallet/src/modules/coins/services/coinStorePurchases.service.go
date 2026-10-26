package services

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentconstants "nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/interfaces"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/generated/ent/coinpackage"
	"nantty/modules/wallet/src/generated/ent/coinpurchase"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/modules/wallet/src/modules/coins/models"
)

var sourceByStore = map[string]coinpurchase.Source{paymentconstants.StoreAppleIap: coinpurchase.SourceApple, paymentconstants.StoreGooglePlay: coinpurchase.SourceGoogle}

func (purchases CoinPurchases) RedeemVerifiedStorePurchaseInTransaction(ctx context.Context, transaction *sql.Tx, userId, store string, verified interfaces.VerifiedStorePurchase) (dtos.VerifiedCoinPurchaseDto, error) {
	client := purchases.Container.Client(transaction)
	platform := map[string]coinpackage.ClientPlatform{paymentconstants.StoreAppleIap: coinpackage.ClientPlatformIos, paymentconstants.StoreGooglePlay: coinpackage.ClientPlatformAndroid}[store]
	pack, err := client.CoinPackage.Query().Where(coinpackage.StoreProductID(verified.ProductId), coinpackage.PurchaseChannelEQ(coinpackage.PurchaseChannelStoreIap), coinpackage.ClientPlatformEQ(platform)).First(ctx)
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, ErrCoinPackageNotFound
	}
	purchaseId := uuid.Must(uuid.NewV7())
	recorded, err := purchases.Container.Payments.RecordVerifiedStorePurchaseInTransaction(ctx, transaction, store, userId, paymentconstants.PurposeCoinPurchase, purchaseId.String(), verified)
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	if recorded.Replayed {
		existing, err := client.CoinPurchase.Get(ctx, uuid.MustParse(recorded.SubjectId))
		if err != nil {
			return dtos.VerifiedCoinPurchaseDto{}, err
		}
		return purchases.receiptForPurchase(ctx, transaction, existing.UserID, ConvertCoinPurchase(existing))
	}
	now := purchases.Container.Now().UTC()
	flags, err := CoinRiskRules{Container: purchases.Container}.FlagsForPurchase(ctx, transaction, userId, purchaseId)
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	purchase, err := client.CoinPurchase.Create().SetReviewStatus(ReviewStateForPurchaseFlags(flags)).SetReviewFlags(flags).SetID(purchaseId).SetUserID(userId).SetPackageID(pack.ID).SetCoins(pack.Coins + pack.BonusCoins).
		SetChannel(coinpurchase.ChannelStoreIap).SetSource(sourceByStore[store]).SetProvider(store).
		SetReference(store + ":" + verified.StoreTransactionId).SetAmountMinor(recorded.PriceMinor).SetCurrency(recorded.Currency).
		SetStoreFeeMinor(recorded.StoreFeeMinor).SetStatus(coinpurchase.StatusSucceeded).SetCreditedAt(now).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CoinSalesRevenueAccount(purchase.Currency), Direction: ledgermodels.Credit, AmountMinor: purchase.AmountMinor},
		{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: purchase.Coins},
		{Account: ledgermodels.UserSpendableCoinsAccount(userId), Direction: ledgermodels.Credit, AmountMinor: purchase.Coins},
	}
	if net := purchase.AmountMinor - purchase.StoreFeeMinor; net > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformProviderBalanceAccount(store, purchase.Currency), Direction: ledgermodels.Debit, AmountMinor: net})
	}
	if purchase.StoreFeeMinor > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.AppStoreFeeExpenseAccount(store, purchase.Currency), Direction: ledgermodels.Debit, AmountMinor: purchase.StoreFeeMinor})
	}
	if _, err := purchases.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "coin-purchase:" + purchase.ID.String(), Kind: "coins.purchased", ExternalReference: verified.StoreTransactionId,
		Description: fmt.Sprintf("Bought %d coins in the app", purchase.Coins), Lines: lines,
		Metadata: map[string]any{"coinPurchaseId": purchase.ID.String(), "store": store, "storeFeeMinor": purchase.StoreFeeMinor},
	}); err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	if err := purchases.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinPurchase.completed", purchase.ID.String(), now, coinPurchaseEventData(purchase)); err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	return purchases.receiptForPurchase(ctx, transaction, userId, ConvertCoinPurchase(purchase))
}

func (purchases CoinPurchases) receiptForPurchase(ctx context.Context, transaction *sql.Tx, userId string, purchase dtos.CoinPurchaseDto) (dtos.VerifiedCoinPurchaseDto, error) {
	balance, err := purchases.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.UserSpendableCoinsAccount(userId))
	return dtos.VerifiedCoinPurchaseDto{Status: purchase.Status, Coins: purchase.Coins, Balance: balance, Purchase: purchase}, err
}

func (purchases CoinPurchases) HandleStorePurchaseRefunded(ctx context.Context, transaction *sql.Tx, refunded paymentmodels.RefundedStorePurchase) error {
	client := purchases.Container.Client(transaction)
	purchase, err := lockCoinPurchase(ctx, client, refunded.SubjectId)
	if err != nil || purchase.Status != coinpurchase.StatusSucceeded {
		return err
	}
	balance, err := purchases.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.UserSpendableCoinsAccount(purchase.UserID))
	if err != nil {
		return err
	}
	clawback := models.SplitCoinClawback(balance, purchase.Coins)
	now := purchases.Container.Now().UTC()
	refundUpdate := purchase.Update().SetStatus(coinpurchase.StatusRefunded).SetRefundedAt(now).SetClawbackShortfallCoins(clawback.ShortfallCoins)
	if clawback.ShortfallCoins > 0 && (purchase.ReviewStatus == coinpurchase.ReviewStatusNotRequired || purchase.ReviewStatus == coinpurchase.ReviewStatusReviewed) {
		refundUpdate.SetReviewStatus(coinpurchase.ReviewStatusPendingReview).SetReviewFlags(append(append([]string{}, purchase.ReviewFlags...), RuleStoreRefundAfterSpend))
	}
	if err := refundUpdate.Exec(ctx); err != nil {
		return err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CoinSalesRevenueAccount(purchase.Currency), Direction: ledgermodels.Debit, AmountMinor: purchase.AmountMinor},
		{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Credit, AmountMinor: purchase.Coins},
	}
	if net := purchase.AmountMinor - purchase.StoreFeeMinor; net > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformProviderBalanceAccount(purchase.Provider, purchase.Currency), Direction: ledgermodels.Credit, AmountMinor: net})
	}
	if purchase.StoreFeeMinor > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.AppStoreFeeExpenseAccount(purchase.Provider, purchase.Currency), Direction: ledgermodels.Credit, AmountMinor: purchase.StoreFeeMinor})
	}
	if clawback.RecoveredCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.UserSpendableCoinsAccount(purchase.UserID), Direction: ledgermodels.Debit, AmountMinor: clawback.RecoveredCoins})
	}
	if clawback.ShortfallCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.UserCoinDebtAccount(purchase.UserID), Direction: ledgermodels.Debit, AmountMinor: clawback.ShortfallCoins})
	}
	if _, err := purchases.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "coin-purchase-refund:" + purchase.ID.String(), Kind: "coins.refundClawedBack", ExternalReference: refunded.StoreTransactionId,
		Description: "Store refund: coins clawed back", Lines: lines,
		Metadata: map[string]any{"recoveredCoins": clawback.RecoveredCoins, "shortfallCoins": clawback.ShortfallCoins},
	}); err != nil {
		return err
	}
	if clawback.ShortfallCoins > 0 {
		if err := client.WalletRiskFlag.Create().SetUserID(purchase.UserID).SetReason("storeRefundAfterCoinsSpent").SetSubjectID(purchase.ID.String()).
			SetCoinsShortfall(clawback.ShortfallCoins).SetCreatedAt(now).Exec(ctx); err != nil {
			return err
		}
	}
	data := coinPurchaseEventData(purchase)
	data["recoveredCoins"], data["shortfallCoins"] = clawback.RecoveredCoins, clawback.ShortfallCoins
	return purchases.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinPurchase.refunded", purchase.ID.String(), now, data)
}
