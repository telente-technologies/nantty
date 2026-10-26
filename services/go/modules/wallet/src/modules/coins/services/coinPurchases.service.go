package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/generated/ent"
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

func (purchases CoinPurchases) VerifyCoinPurchase(ctx context.Context, userId, reference string) (dtos.VerifiedCoinPurchaseDto, error) {
	client := purchases.Container.Client(purchases.Container.Resources.Database)
	purchase, err := client.CoinPurchase.Query().Where(coinpurchase.Reference(reference), coinpurchase.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.VerifiedCoinPurchaseDto{}, ErrCoinPurchaseNotFound
	}
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	if purchase.Status == coinpurchase.StatusPending && purchase.Channel == coinpurchase.ChannelWebCheckout {
		if _, err := purchases.Container.Payments.VerifyAndSettlePaymentIntentByReference(ctx, reference); err != nil {
			return dtos.VerifiedCoinPurchaseDto{}, err
		}
		if purchase, err = client.CoinPurchase.Get(ctx, purchase.ID); err != nil {
			return dtos.VerifiedCoinPurchaseDto{}, err
		}
	}
	balance, err := purchases.Container.Ledger.ReadAccountBalance(ctx, purchases.Container.Resources.Database, ledgermodels.UserSpendableCoinsAccount(userId))
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, err
	}
	return dtos.VerifiedCoinPurchaseDto{Status: string(purchase.Status), Coins: purchase.Coins, Balance: balance, Purchase: ConvertCoinPurchase(purchase)}, nil
}

func lockCoinPurchase(ctx context.Context, client *ent.Client, purchaseId string) (*ent.CoinPurchase, error) {
	identifier, err := uuid.Parse(purchaseId)
	if err != nil {
		return nil, ErrCoinPurchaseNotFound
	}
	purchase, err := client.CoinPurchase.Query().Where(coinpurchase.ID(identifier)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrCoinPurchaseNotFound
	}
	return purchase, err
}

func ConvertCoinPurchase(purchase *ent.CoinPurchase) dtos.CoinPurchaseDto {
	return dtos.CoinPurchaseDto{
		Id: purchase.ID.String(), Reference: purchase.Reference, PackageId: purchase.PackageID, Coins: purchase.Coins,
		Channel: string(purchase.Channel), Source: string(purchase.Source), Status: string(purchase.Status), CreatedAt: purchase.CreatedAt,
		Amount: dtos.MoneyDto{AmountMinor: purchase.AmountMinor, Currency: purchase.Currency},
	}
}

func coinPurchaseEventData(purchase *ent.CoinPurchase) map[string]any {
	return map[string]any{
		"coinPurchaseId": purchase.ID.String(), "userId": purchase.UserID, "packageId": purchase.PackageID, "coins": purchase.Coins,
		"source": string(purchase.Source), "amount": map[string]any{"amountMinor": purchase.AmountMinor, "currency": purchase.Currency},
	}
}
