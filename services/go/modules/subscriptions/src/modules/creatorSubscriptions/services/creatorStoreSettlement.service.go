package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentinterfaces "nantty/modules/payments/src/interfaces"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/creatorsubscription"
	"nantty/modules/subscriptions/src/generated/ent/creatorsubscriptioncharge"
	"nantty/modules/subscriptions/src/models"
	"nantty/platform/regionpricing"
)

var channelByStore = map[string]string{paymentconstants.StoreAppleIap: "ios", paymentconstants.StoreGooglePlay: "android"}

func (service CreatorSubscriptions) applyStoreTransactionInTransaction(ctx context.Context, transaction *sql.Tx, store string, verified paymentinterfaces.VerifiedStorePurchase, subscriberId string) (*ent.CreatorSubscription, error) {
	client := service.Container.Client(transaction)
	row, err := service.findStoreSubscription(ctx, client, store, verified.AccountToken, verified.OriginalTransactionId)
	if err != nil {
		return nil, err
	}
	if subscriberId != "" && row.SubscriberID != subscriberId {
		return nil, ErrStoreReceiptUnclaimed
	}
	bought, boughtOk := regionpricing.ParseCreatorStoreProductId(verified.ProductId)
	assigned, assignedOk := regionpricing.ParseCreatorStoreProductId(row.StoreProductID)
	if !boughtOk || !assignedOk || bought.Tier != assigned.Tier || bought.Interval != assigned.Interval ||
		(row.StoreOriginalTransactionID != "" && row.StoreOriginalTransactionID != verified.OriginalTransactionId) {
		return nil, ErrStoreReceiptMismatch
	}
	key := "store:" + store + ":" + verified.StoreTransactionId
	if exists, err := client.CreatorSubscriptionCharge.Query().Where(creatorsubscriptioncharge.IdempotencyKey(key)).Exist(ctx); err != nil || exists {
		return row, err
	}
	chargeId := uuid.Must(uuid.NewV7())
	feeBps := service.StoreFees(ctx).FeeBpsForChannel(channelByStore[store])
	recorded, err := service.Container.Payments.RecordVerifiedStorePurchaseWithFeeInTransaction(ctx, transaction, store, row.SubscriberID, paymentconstants.PurposeCreatorSubscription, chargeId.String(), verified, feeBps)
	if err != nil || recorded.Replayed {
		return row, err
	}
	now := service.Container.Now().UTC()
	kind := creatorsubscriptioncharge.KindRenewal
	if row.Status == creatorsubscription.StatusPending {
		kind = creatorsubscriptioncharge.KindInitial
	}
	split := models.SplitCreatorSubscriptionCharge(recorded.PriceMinor, recorded.StoreFeeMinor)
	charge, err := client.CreatorSubscriptionCharge.Create().SetID(chargeId).SetSubscriptionID(row.ID.String()).SetSubscriberID(row.SubscriberID).SetCreatorID(row.CreatorID).
		SetKind(kind).SetIdempotencyKey(key).SetPaymentReference(truncateText(store+":"+verified.StoreTransactionId, 80)).SetAttemptCount(1).
		SetAmountMinor(recorded.PriceMinor).SetCurrency(recorded.Currency).SetStatus(creatorsubscriptioncharge.StatusSucceeded).SetProviderFeeMinor(recorded.StoreFeeMinor).
		SetCreatorShareMinor(split.CreatorShareMinor).SetPlatformShareMinor(split.PlatformMinor).SetPeriodStart(verified.PurchasedAt).SetPaidAt(now).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := service.postStoreChargeRevenue(ctx, transaction, store, charge, split, verified.StoreTransactionId); err != nil {
		return nil, err
	}
	row, err = row.Update().SetStatus(creatorsubscription.StatusActive).SetCurrentPeriodStart(verified.PurchasedAt).SetCurrentPeriodEnd(*verified.ExpiresAt).
		SetStoreOriginalTransactionID(verified.OriginalTransactionId).SetStoreProductID(verified.ProductId).SetStoreSlot(bought.Slot).
		ClearNextChargeAt().SetRenewalAttempts(0).SetLastError("").Save(ctx)
	if err != nil {
		return nil, err
	}
	data := chargeEventData(row, charge, split, store+":"+verified.StoreTransactionId)
	data["paidAt"], data["periodEnd"], data["billingChannel"] = now.Format(time.RFC3339), verified.ExpiresAt.UTC().Format(time.RFC3339), store
	if err := service.emit(ctx, transaction, "creatorSubscription.paid", row.ID.String(), data); err != nil {
		return nil, err
	}
	if kind == creatorsubscriptioncharge.KindInitial {
		return row, service.emit(ctx, transaction, "creatorSubscription.started", row.ID.String(), data)
	}
	return row, nil
}

func (service CreatorSubscriptions) postStoreChargeRevenue(ctx context.Context, transaction *sql.Tx, store string, charge *ent.CreatorSubscriptionCharge, split models.CreatorChargeSplit, storeTransactionId string) error {
	lines := storeChargeLines(store, charge, split)
	_, err := service.Container.Payments.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "creator-subscription-charge:" + charge.ID.String(), Kind: "creatorSubscription.charged", ExternalReference: storeTransactionId,
		Description: "Creator subscription " + charge.Kind.String() + " bought in the app",
		Metadata: map[string]any{
			"creatorSubscriptionId": charge.SubscriptionID, "chargeId": charge.ID.String(), "creatorId": charge.CreatorID, "store": store,
			"storeFeeMinor": charge.ProviderFeeMinor, "netMinor": split.NetMinor, "creatorShareBpsOfNet": models.CreatorShareOfNetBps,
		},
		Lines: lines,
	})
	return err
}

func storeChargeLines(store string, charge *ent.CreatorSubscriptionCharge, split models.CreatorChargeSplit) []ledgermodels.JournalLineRequest {
	var lines []ledgermodels.JournalLineRequest
	add := func(account ledgermodels.AccountRef, direction ledgermodels.Direction, amount int64) {
		if amount > 0 {
			lines = append(lines, ledgermodels.JournalLineRequest{Account: account, Direction: direction, AmountMinor: amount})
		}
	}
	add(ledgermodels.PlatformProviderBalanceAccount(store, charge.Currency), ledgermodels.Debit, charge.AmountMinor-charge.ProviderFeeMinor)
	add(ledgermodels.AppStoreFeeExpenseAccount(store, charge.Currency), ledgermodels.Debit, charge.ProviderFeeMinor)
	add(ledgermodels.CreatorEarningsPayableAccount(charge.CreatorID, charge.Currency), ledgermodels.Credit, split.CreatorShareMinor)
	add(ledgermodels.CreatorSubscriptionRevenueAccount(charge.Currency), ledgermodels.Credit, split.PlatformMinor)
	return lines
}

func (service CreatorSubscriptions) HandleStorePurchaseRefunded(ctx context.Context, transaction *sql.Tx, refunded paymentmodels.RefundedStorePurchase) error {
	charge, row, err := service.lockCharge(ctx, transaction, refunded.SubjectId)
	if err != nil || charge == nil || charge.Status != creatorsubscriptioncharge.StatusSucceeded {
		return err
	}
	payable := ledgermodels.CreatorEarningsPayableAccount(charge.CreatorID, charge.Currency)
	balance, err := service.Container.Payments.Container.Ledger.ReadAccountBalance(ctx, transaction, payable)
	if err != nil {
		return err
	}
	recovered := min(max(balance, 0), charge.CreatorShareMinor)
	lines := []ledgermodels.JournalLineRequest{}
	for _, line := range storeChargeLines(refunded.Store, charge, models.CreatorChargeSplit{CreatorShareMinor: charge.CreatorShareMinor, PlatformMinor: charge.PlatformShareMinor}) {
		line.Direction = map[ledgermodels.Direction]ledgermodels.Direction{ledgermodels.Debit: ledgermodels.Credit, ledgermodels.Credit: ledgermodels.Debit}[line.Direction]
		if line.Account == payable {
			line.AmountMinor = recovered
		}
		if line.AmountMinor > 0 {
			lines = append(lines, line)
		}
	}
	if shortfall := charge.CreatorShareMinor - recovered; shortfall > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarningsDebtAccount(charge.CreatorID, charge.Currency), Direction: ledgermodels.Debit, AmountMinor: shortfall})
	}
	if _, err := service.Container.Payments.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "creator-subscription-refund:" + charge.ID.String(), Kind: "creatorSubscription.refundClawedBack", ExternalReference: refunded.StoreTransactionId,
		Description: "Store refund: creator subscription earnings clawed back", Lines: lines,
		Metadata: map[string]any{"chargeId": charge.ID.String(), "recoveredMinor": recovered, "shortfallMinor": charge.CreatorShareMinor - recovered},
	}); err != nil {
		return err
	}
	now := service.Container.Now().UTC()
	if err := charge.Update().SetStatus(creatorsubscriptioncharge.StatusRefunded).SetRefundedAt(now).Exec(ctx); err != nil {
		return err
	}
	if row.Status != creatorsubscription.StatusExpired {
		if row, err = row.Update().SetStatus(creatorsubscription.StatusExpired).SetCurrentPeriodEnd(now).ClearNextChargeAt().Save(ctx); err != nil {
			return err
		}
	}
	data := lifecycleEventData(row)
	data["chargeId"], data["reason"], data["store"] = charge.ID.String(), "store_refund", refunded.Store
	data["recovered"], data["shortfall"] = MoneyView{recovered, charge.Currency}, MoneyView{charge.CreatorShareMinor - recovered, charge.Currency}
	return service.emit(ctx, transaction, "creatorSubscription.refunded", row.ID.String(), data)
}
