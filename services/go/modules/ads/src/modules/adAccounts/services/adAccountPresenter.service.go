package services

import (
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	"nantty/modules/ads/src/types"
)

func PresentAccountSummary(account *ent.AdAccount, role string, activeCampaigns int) dtos.AdAccountSummary {
	return dtos.AdAccountSummary{
		Id: account.ID.String(), Name: account.Name, Kind: string(account.Kind), Currency: account.Currency, Timezone: account.Timezone, CountryCode: account.CountryCode,
		Status: string(account.Status), MyRole: role, VerifiedBusiness: account.VerifiedBusiness, Balance: types.Money{AmountMinor: account.BalanceMinor, Currency: account.Currency},
		ActiveCampaignCount: activeCampaigns,
	}
}

func PresentAccount(account *ent.AdAccount, role, ownerName string, activeCampaigns int) dtos.AdAccount {
	presented := dtos.AdAccount{
		AdAccountSummary: PresentAccountSummary(account, role, activeCampaigns), CreatedAt: account.CreatedAt.UTC().Format(time.RFC3339),
		Owner: dtos.AccountOwner{Id: account.OwnerUserID.String(), Name: ownerName}, AmountSpent: types.Money{AmountMinor: account.AmountSpentMicros / types.MicrosPerMinorUnit, Currency: account.Currency},
	}
	if account.DisabledReason != "" {
		reason := account.DisabledReason
		presented.DisabledReason = &reason
	}
	return presented
}
