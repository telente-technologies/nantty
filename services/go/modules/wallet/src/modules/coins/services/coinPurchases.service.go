package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/generated/ent/coinpackage"
	"nantty/modules/wallet/src/generated/ent/coinpurchase"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/modules/wallet/src/modules/coins/models"
	"nantty/platform/httpserver"
)

var ErrCoinPurchaseNotFound = httpserver.NewApiError(http.StatusNotFound, "COIN_PURCHASE_NOT_FOUND", "Coin purchase was not found.")

type CoinPurchases struct {
	Container *container.Container
	Catalog   CoinCatalog
}

type StartWebCoinPurchaseInput struct {
	UserId    string
	PackageId string
	Provider  string
	Currency  string
	ReturnTo  string
}

func (purchases CoinPurchases) StartWebCoinPurchaseInTransaction(ctx context.Context, transaction *sql.Tx, input StartWebCoinPurchaseInput) (dtos.StartedCoinPurchaseDto, error) {
	client := purchases.Container.Client(transaction)
	pack, err := purchases.Catalog.FindActivePackage(ctx, client, input.PackageId, coinpackage.PurchaseChannelWebCheckout)
	if err != nil {
		return dtos.StartedCoinPurchaseDto{}, err
	}
	provider, err := purchases.Container.Payments.Container.Provider(input.Provider)
	if err != nil {
		return dtos.StartedCoinPurchaseDto{}, err
	}
	price, err := models.ChooseCoinPackagePrice(DecodeCoinPackagePrices(pack), input.Currency, provider.SupportsCurrency)
	if err != nil {
		return dtos.StartedCoinPurchaseDto{}, err
	}
	purchaseId := uuid.Must(uuid.NewV7())
	intent, err := purchases.Container.Payments.CreatePendingPaymentIntentInTransaction(ctx, transaction, paymentmodels.CreatePaymentIntentRequest{
		Purpose: paymentconstants.PurposeCoinPurchase, OwnerUserId: input.UserId, SubjectId: purchaseId.String(), Provider: input.Provider,
		AmountMinor: price.AmountMinor, Currency: price.Currency, ReturnTo: input.ReturnTo,
		Metadata: map[string]string{"packageId": pack.ID, "coinPurchaseId": purchaseId.String()},
	})
	if err != nil {
		return dtos.StartedCoinPurchaseDto{}, err
	}
	purchase, err := client.CoinPurchase.Create().SetID(purchaseId).SetUserID(input.UserId).SetPackageID(pack.ID).
		SetCoins(pack.Coins + pack.BonusCoins).SetChannel(coinpurchase.ChannelWebCheckout).SetSource(coinpurchase.SourceWeb).
		SetProvider(input.Provider).SetReference(intent.Reference).SetAmountMinor(price.AmountMinor).SetCurrency(price.Currency).
		SetPaymentIntentID(intent.Id).SetCreatedAt(purchases.Container.Now()).Save(ctx)
	if err != nil {
		return dtos.StartedCoinPurchaseDto{}, err
	}
	converted := ConvertCoinPurchase(purchase)
	callbackUrl := intent.CallbackUrl
	return dtos.StartedCoinPurchaseDto{
		Reference: purchase.Reference, PurchaseChannel: string(purchase.Channel), CallbackUrl: &callbackUrl, Purchase: &converted, PaymentIntentId: intent.Id.String(),
	}, nil
}

func (purchases CoinPurchases) OpenCheckoutForStartedPurchase(ctx context.Context, started dtos.StartedCoinPurchaseDto) (dtos.StartedCoinPurchaseDto, error) {
	intentId, err := uuid.Parse(started.PaymentIntentId)
	if err != nil {
		return started, nil
	}
	opened, err := purchases.Container.Payments.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		return started, err
	}
	started.AuthorizationUrl = opened.CheckoutUrl
	return started, nil
}

func (purchases CoinPurchases) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	client := purchases.Container.Client(transaction)
	purchase, err := lockCoinPurchase(ctx, client, payment.SubjectId)
	if err != nil || purchase.Status != coinpurchase.StatusPending {
		return err
	}
	if purchase.AmountMinor != payment.AmountMinor || purchase.Currency != payment.Currency {
		return fmt.Errorf("coin purchase %s expects %d %s but %d %s settled", purchase.ID, purchase.AmountMinor, purchase.Currency, payment.AmountMinor, payment.Currency)
	}
	now := purchases.Container.Now().UTC()
	flags, err := CoinRiskRules{Container: purchases.Container}.FlagsForPurchase(ctx, transaction, purchase.UserID, purchase.ID)
	if err != nil {
		return err
	}
	if err := purchase.Update().SetStatus(coinpurchase.StatusSucceeded).SetCreditedAt(now).SetReviewStatus(ReviewStateForPurchaseFlags(flags)).SetReviewFlags(flags).Exec(ctx); err != nil {
		return err
	}
	_, err = purchases.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "coin-purchase:" + purchase.ID.String(), Kind: "coins.purchased", Description: fmt.Sprintf("Bought %d coins", purchase.Coins),
		Metadata: map[string]any{"coinPurchaseId": purchase.ID.String(), "paymentReference": payment.Reference, "source": string(purchase.Source)},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(purchase.Currency), Direction: ledgermodels.Debit, AmountMinor: purchase.AmountMinor},
			{Account: ledgermodels.CoinSalesRevenueAccount(purchase.Currency), Direction: ledgermodels.Credit, AmountMinor: purchase.AmountMinor},
			{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: purchase.Coins},
			{Account: ledgermodels.UserSpendableCoinsAccount(purchase.UserID), Direction: ledgermodels.Credit, AmountMinor: purchase.Coins},
		},
	})
	if err != nil {
		return err
	}
	return purchases.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinPurchase.completed", purchase.ID.String(), now, coinPurchaseEventData(purchase))
}

func (purchases CoinPurchases) HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	client := purchases.Container.Client(transaction)
	purchase, err := lockCoinPurchase(ctx, client, payment.SubjectId)
	if err != nil || purchase.Status != coinpurchase.StatusPending {
		return err
	}
	return purchase.Update().SetStatus(coinpurchase.StatusFailed).Exec(ctx)
}

// HandleProviderDispute applies coin clawback only after the provider reports a
// final loss. It runs in the payment module's transaction, so the dispute
// receipt, coin ledger, staff-review flag, and cash chargeback accounting commit
// or roll back together.
func (purchases CoinPurchases) HandleProviderDispute(ctx context.Context, transaction *sql.Tx, notice paymentmodels.ProviderDisputeNotice) error {
	if notice.Status != "lost" {
		return nil
	}
	if notice.ProviderDisputeId == "" || notice.AmountMinor <= 0 {
		return fmt.Errorf("lost coin-purchase dispute requires a provider dispute id and positive amount")
	}

	client := purchases.Container.Client(transaction)
	purchase, err := lockCoinPurchase(ctx, client, notice.SubjectId)
	if err != nil {
		return err
	}
	if notice.Purpose != paymentconstants.PurposeCoinPurchase || purchase.PaymentIntentID == nil || purchase.PaymentIntentID.String() != notice.PaymentIntentId.String() {
		return fmt.Errorf("provider dispute does not match the coin purchase payment intent")
	}
	if purchase.Channel != coinpurchase.ChannelWebCheckout || (purchase.Status != coinpurchase.StatusSucceeded && purchase.Status != coinpurchase.StatusRefunded) {
		return fmt.Errorf("lost provider dispute references a coin purchase that was not a completed web checkout")
	}
	if purchase.AmountMinor <= 0 || !strings.EqualFold(purchase.Currency, notice.Currency) {
		return fmt.Errorf("lost provider dispute amount or currency does not match the coin purchase")
	}

	providerIntent, err := purchases.Container.Payments.Container.Client(transaction).PaymentIntent.Get(ctx, notice.PaymentIntentId)
	if err != nil {
		return err
	}
	if providerIntent.Purpose != paymentconstants.PurposeCoinPurchase || providerIntent.SubjectID != purchase.ID.String() || providerIntent.AmountMinor != purchase.AmountMinor || !strings.EqualFold(providerIntent.Currency, purchase.Currency) {
		return fmt.Errorf("coin purchase does not match its payment intent")
	}

	// A repeated final notice is an idempotent no-op. Locking the purchase first
	// serializes distinct partial disputes for the same purchase.
	var existingAmount int64
	var existingPurchase uuid.UUID
	chargebacksTable := pgx.Identifier{purchases.Container.Settings.Money.DatabaseSchema, "coin_purchase_chargebacks"}.Sanitize()
	err = transaction.QueryRowContext(ctx, `SELECT purchase_id, amount_minor FROM `+chargebacksTable+` WHERE provider = $1 AND provider_dispute_id = $2`, providerIntent.Provider, notice.ProviderDisputeId).Scan(&existingPurchase, &existingAmount)
	if err == nil {
		if existingPurchase != purchase.ID || existingAmount != notice.AmountMinor {
			return fmt.Errorf("provider dispute was already recorded against a different purchase or amount")
		}
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}

	var priorAmount, priorCoins int64
	if err := transaction.QueryRowContext(ctx, `SELECT COALESCE(SUM(amount_minor), 0), COALESCE(SUM(coins_clawed), 0) FROM `+chargebacksTable+` WHERE purchase_id = $1`, purchase.ID).Scan(&priorAmount, &priorCoins); err != nil {
		return err
	}
	if priorAmount < 0 || priorAmount > purchase.AmountMinor || priorCoins < 0 || priorCoins > purchase.Coins {
		return fmt.Errorf("stored coin chargeback totals exceed the purchase bounds")
	}
	if notice.AmountMinor > purchase.AmountMinor-priorAmount {
		return fmt.Errorf("cumulative lost dispute amount exceeds the coin purchase amount")
	}
	cumulativeAmount := priorAmount + notice.AmountMinor
	targetCoins, err := models.ProportionalCoinChargeback(cumulativeAmount, purchase.Coins, purchase.AmountMinor)
	if err != nil {
		return err
	}
	alreadyClawed := priorCoins
	// A separate completed refund/reversal has already removed all purchased
	// coins. Do not claw those coins a second time when a later chargeback lands.
	if purchase.Status == coinpurchase.StatusRefunded || purchase.ReviewStatus == coinpurchase.ReviewStatusReversed {
		alreadyClawed = purchase.Coins
	}
	coinsToClaw := max(targetCoins-alreadyClawed, 0)
	if coinsToClaw > purchase.Coins-alreadyClawed {
		return fmt.Errorf("calculated coin chargeback clawback exceeds the remaining purchased coins")
	}

	inserted, err := transaction.ExecContext(ctx, `INSERT INTO `+chargebacksTable+` (id, created_at, purchase_id, provider, provider_dispute_id, amount_minor, coins_clawed, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $2) ON CONFLICT (provider, provider_dispute_id) DO NOTHING`, uuid.Must(uuid.NewV7()), purchases.Container.Now().UTC(), purchase.ID, providerIntent.Provider, notice.ProviderDisputeId, notice.AmountMinor, coinsToClaw)
	if err != nil {
		return err
	}
	insertedCount, err := inserted.RowsAffected()
	if err != nil {
		return err
	}
	if insertedCount == 0 {
		return nil
	}

	clawback := models.CoinClawback{}
	if coinsToClaw > 0 {
		buyerCoins := ledgermodels.UserSpendableCoinsAccount(purchase.UserID)
		balance, err := purchases.Container.Ledger.ReadAccountBalance(ctx, transaction, buyerCoins)
		if err != nil {
			return err
		}
		clawback = models.SplitCoinClawback(balance, coinsToClaw)
		lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Credit, AmountMinor: coinsToClaw}}
		if clawback.RecoveredCoins > 0 {
			lines = append(lines, ledgermodels.JournalLineRequest{Account: buyerCoins, Direction: ledgermodels.Debit, AmountMinor: clawback.RecoveredCoins})
		}
		if clawback.ShortfallCoins > 0 {
			lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.UserCoinDebtAccount(purchase.UserID), Direction: ledgermodels.Debit, AmountMinor: clawback.ShortfallCoins})
		}
		if _, err := purchases.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "coin-purchase-chargeback:" + providerIntent.Provider + ":" + notice.ProviderDisputeId,
			Kind:      "coins.purchaseChargebackLost", Description: "Coins removed after a lost card or bank chargeback",
			Metadata: map[string]any{"coinPurchaseId": purchase.ID.String(), "providerDisputeId": notice.ProviderDisputeId, "chargedBackMinor": notice.AmountMinor, "cumulativeChargedBackMinor": cumulativeAmount, "recoveredCoins": clawback.RecoveredCoins, "shortfallCoins": clawback.ShortfallCoins},
			Lines:    lines,
		}); err != nil {
			return err
		}
	}

	if providerIntent.Provider == "flutterwave" {
		if _, err := purchases.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "coin-purchase-chargeback-loss:" + notice.ProviderDisputeId, Kind: "chargeback.lostUnrecovered",
			ExternalReference: purchase.Reference, Description: "Lost provider chargeback on a coin purchase",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.PlatformUnreconciledLossAccount(purchase.Currency), Direction: ledgermodels.Debit, AmountMinor: notice.AmountMinor},
				{Account: ledgermodels.PlatformChargebackReceivableAccount(providerIntent.Provider, purchase.Currency), Direction: ledgermodels.Credit, AmountMinor: notice.AmountMinor},
			},
		}); err != nil {
			return err
		}
	}

	flags := append([]string(nil), purchase.ReviewFlags...)
	if !slices.Contains(flags, "coin_purchase_chargeback_lost") {
		flags = append(flags, "coin_purchase_chargeback_lost")
	}
	now := purchases.Container.Now().UTC()
	if err := purchase.Update().SetReviewStatus(coinpurchase.ReviewStatusPendingReview).SetReviewFlags(flags).
		SetReviewedByStaffID("").ClearReviewedAt().AddClawbackShortfallCoins(clawback.ShortfallCoins).
		SetReviewNote("Provider dispute lost; coin clawback and chargeback require staff review.").Exec(ctx); err != nil {
		return err
	}
	if clawback.ShortfallCoins > 0 {
		if err := client.WalletRiskFlag.Create().SetUserID(purchase.UserID).SetReason("coinPurchaseChargebackLost").SetSubjectID(notice.ProviderDisputeId).
			SetCoinsShortfall(clawback.ShortfallCoins).SetCreatedAt(now).Exec(ctx); err != nil {
			return err
		}
	}
	return purchases.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinPurchase.chargebackLost", purchase.ID.String(), now, map[string]any{
		"coinPurchaseId": purchase.ID.String(), "userId": purchase.UserID, "provider": providerIntent.Provider, "providerDisputeId": notice.ProviderDisputeId,
		"chargedBackMinor": notice.AmountMinor, "cumulativeChargedBackMinor": cumulativeAmount, "coinsClawed": coinsToClaw,
		"recoveredCoins": clawback.RecoveredCoins, "shortfallCoins": clawback.ShortfallCoins,
	})
}
