package ads_test

import (
	"context"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/generated/ent/adimpression"
	"nantty/modules/ads/src/services"
)

func TestConcurrentSettlementWorkersChargePendingImpressionOnce(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	client := h.module.Container.Client
	account, err := client.AdAccount.Create().SetName("Concurrent advertiser").SetKind(adaccount.KindPersonal).SetOwnerUserID(uuid.New()).SetCountryCode("NG").SetCurrency("NGN").SetBalanceMinor(100_000).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.AdImpression.Create().SetID(uuid.Must(uuid.NewV7())).SetServedAt(h.clock.Now()).SetAdID(uuid.New()).SetAdGroupID(uuid.New()).SetCampaignID(uuid.New()).
		SetAccountID(account.ID).SetUserID("viewer").SetSessionID("session").SetPlacement("feed").SetSlotKind("feedPost").SetCurrency("NGN").SetBasis(adimpression.BasisCpm).SetPctrPpm(0).
		SetPriceMicros(1_000_000_000).SetPctrPpm(0).SetChargeMicros(1_000_000_000).SetCreatorUserID("creator").SetCreatorShareMicros(400_000_000).SetPlatformShareMicros(600_000_000).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	settlement := services.AdSettlement{Client: client, Now: h.clock.Now}
	start := make(chan struct{})
	type result struct {
		count int
		err   error
	}
	results := make(chan result, 2)
	var workers sync.WaitGroup
	for range 2 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			<-start
			count, err := settlement.SettlePendingCharges(ctx)
			results <- result{count: count, err: err}
		}()
	}
	close(start)
	workers.Wait()
	close(results)
	totalSettled := 0
	for result := range results {
		if result.err != nil {
			t.Fatal(result.err)
		}
		totalSettled += result.count
	}
	if totalSettled != 1 {
		t.Fatalf("the concurrent workers must report one settlement total, got %d", totalSettled)
	}
	reloaded, err := client.AdAccount.Get(ctx, account.ID)
	if err != nil || reloaded.BalanceMinor != 99_000 {
		t.Fatalf("advertiser should be debited exactly once: balance=%d err=%v", reloaded.BalanceMinor, err)
	}
	batches, err := client.AdSpendBatch.Query().All(ctx)
	if err != nil || len(batches) != 1 {
		t.Fatalf("one authoritative spend batch is expected: batches=%d err=%v", len(batches), err)
	}
	spendRows, err := client.AdFundsTransaction.Query().Where(adfundstransaction.AccountID(account.ID), adfundstransaction.TypeEQ(adfundstransaction.TypeAdSpend)).All(ctx)
	if err != nil || len(spendRows) != 1 {
		t.Fatalf("one advertiser debit is expected: rows=%d err=%v", len(spendRows), err)
	}
	earnings, err := client.AdCreatorEarning.Query().All(ctx)
	if err != nil || len(earnings) != 1 || earnings[0].AccruedMicros != 400_000_000 {
		t.Fatalf("creator allocation must be posted once: earnings=%+v err=%v", earnings, err)
	}
}
