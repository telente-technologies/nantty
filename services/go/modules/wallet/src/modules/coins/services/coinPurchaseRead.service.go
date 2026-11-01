package services

import (
	"context"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/coinpurchase"
	"nantty/modules/wallet/src/modules/coins/dtos"
)

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
