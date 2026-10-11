package ads

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/adfundstransaction"
	"zudomart/modules/ads/src/generated/ent/adimpression"
	"zudomart/modules/ads/src/services"
)

func TestOneAdvertisersShortfallIsRecordedAsDebtOnceAndOtherAdvertisersStillSettle(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	client := h.module.Container.Client
	createAccount := func(name string, balanceMinor int64) uuid.UUID {
		account, err := client.AdAccount.Create().SetName(name).SetKind(adaccount.KindPersonal).SetOwnerUserID(uuid.New()).SetCountryCode("NG").SetCurrency("NGN").SetBalanceMinor(balanceMinor).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return account.ID
	}
	serve := func(accountId uuid.UUID, count int, chargeMicros int64) {
		for index := 0; index < count; index++ {
			err := client.AdImpression.Create().SetID(uuid.Must(uuid.NewV7())).SetServedAt(h.clock.Now()).SetAdID(uuid.New()).SetAdGroupID(uuid.New()).SetCampaignID(uuid.New()).
				SetAccountID(accountId).SetUserID("viewer").SetSessionID("s").SetPlacement("feed").SetSlotKind("feedPost").SetCurrency("NGN").SetBasis(adimpression.BasisCpm).
				SetPriceMicros(chargeMicros).SetPctrPpm(0).SetChargeMicros(chargeMicros).SetCreatorUserID("creator-1").SetCreatorShareMicros(chargeMicros / 2).SetPlatformShareMicros(chargeMicros / 2).Exec(ctx)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	poor, rich := createAccount("Poor Shop", 1_000), createAccount("Rich Shop", 1_000_000)
	serve(poor, 4, 1_000_000_000)
	serve(rich, 3, 1_000_000_000)
	settlement := services.AdSettlement{Client: client, Now: h.clock.Now}
	settled, err := settlement.SettlePendingCharges(ctx)
	if err != nil || settled != 7 {
		t.Fatalf("both advertisers must settle despite one shortfall: settled %d, err %v", settled, err)
	}
	if again, err := settlement.SettlePendingCharges(ctx); err != nil || again != 0 {
		t.Fatalf("a rerun must find nothing left: %d %v", again, err)
	}
	richAccount, _ := client.AdAccount.Get(ctx, rich)
	if richAccount.BalanceMinor != 1_000_000-3_000 || richAccount.Status != adaccount.StatusActive {
		t.Fatalf("the funded advertiser is charged normally: %+v", richAccount)
	}
	poorAccount, _ := client.AdAccount.Get(ctx, poor)
	if poorAccount.BalanceMinor != 0 || poorAccount.Status != adaccount.StatusDisabled {
		t.Fatalf("the short advertiser pays what it has and is paused: %+v", poorAccount)
	}
	debts, err := client.AdFundsTransaction.Query().Where(adfundstransaction.AccountID(poor), adfundstransaction.TypeEQ(adfundstransaction.TypeAdSpendDebt)).All(ctx)
	if err != nil || len(debts) != 1 || debts[0].AmountMinor != 3_000 {
		t.Fatalf("exactly one debt for the unpaid 3,000: %+v %v", debts, err)
	}
	earning, err := client.AdCreatorEarning.Query().Only(ctx)
	if err != nil || earning.AccruedMicros != 1_500_000_000+500_000_000 {
		t.Fatalf("creators earn only on spend that was collected: %+v %v", earning, err)
	}
}
