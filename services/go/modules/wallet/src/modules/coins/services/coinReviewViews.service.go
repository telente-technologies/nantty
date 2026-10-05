package services

import (
	ledgerrepositories "zudomart/modules/ledger/src/repositories"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

func convertCoinRecord(record CoinTransactionRecord, parties map[string]ledgerrepositories.PartySummary, flags map[string][]string) dtos.CoinTransactionDto {
	view := dtos.CoinTransactionDto{Flags: []string{}, ChargebackRisk: "low"}
	involved := []string{}
	if purchase := record.Purchase; purchase != nil {
		reference, provider, channel := purchase.Reference, purchase.Provider, string(purchase.Channel)
		view.Id, view.Kind, view.Reference, view.Sender = purchase.ID.String(), "purchase", &reference, parties[purchase.UserID]
		view.Coins, view.FiatValue = purchase.Coins, &dtos.MoneyDto{AmountMinor: purchase.AmountMinor, Currency: purchase.Currency}
		view.PaymentProvider, view.Channel, view.TransactionStatus = &provider, &channel, string(purchase.Status)
		view.ReviewStatus, view.ClawbackShortfallCoins, view.CreatedAt, view.ReviewedAt = string(purchase.ReviewStatus), purchase.ClawbackShortfallCoins, purchase.CreatedAt, purchase.ReviewedAt
		view.ReviewedByStaffId, view.ReviewNote = optionalText(purchase.ReviewedByStaffID), optionalText(purchase.ReviewNote)
		involved = append(involved, purchase.UserID)
	} else {
		transfer := record.Transfer
		receiver := parties[transfer.RecipientUserID]
		feeCoins, feeBps := transfer.FeeCoins, transfer.FeeBps
		view.Id, view.Kind, view.Sender, view.Receiver = transfer.ID.String(), "transfer", parties[transfer.SenderUserID], &receiver
		view.Coins, view.FeeCoins, view.PlatformFeeBasisPoints, view.TransactionStatus = transfer.Coins, &feeCoins, &feeBps, "completed"
		if transfer.ReversedAt != nil {
			view.TransactionStatus = "reversed"
		}
		view.ReviewStatus, view.ClawbackShortfallCoins, view.CreatedAt, view.ReviewedAt = string(transfer.ReviewStatus), transfer.ClawbackShortfallCoins, transfer.CreatedAt, transfer.ReviewedAt
		view.ReviewedByStaffId, view.ReviewNote = optionalText(transfer.ReviewedByStaffID), optionalText(transfer.ReviewNote)
		involved = append(involved, transfer.SenderUserID, transfer.RecipientUserID)
	}
	for _, userId := range involved {
		view.Flags = append(view.Flags, flags[userId]...)
	}
	if len(view.Flags) > 0 {
		view.ChargebackRisk = "high"
	}
	return view
}

func optionalText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
