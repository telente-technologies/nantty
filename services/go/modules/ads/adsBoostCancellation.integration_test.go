package ads

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	src "nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/generated/ent/adimpression"
	"nantty/modules/ads/src/generated/ent/outboxevent"
	"nantty/modules/ads/src/jobs"
	confirmboostpayment "nantty/modules/ads/src/modules/boosts/commands/confirmBoostPayment"
)

type boostRefund struct {
	key, debitKey string
	amountMinor   int64
}

type recordingFunding struct {
	mutex   sync.Mutex
	refunds map[string]boostRefund
	calls   int
}

func (funding *recordingFunding) ChargeUserWalletForBoost(context.Context, string, string, int64, string) error {
	return nil
}
func (funding *recordingFunding) ChargeEarningsForBoost(context.Context, string, string, int64, string) error {
	return nil
}
func (funding *recordingFunding) RefundBoostCharge(_ context.Context, _, _ string, amountMinor int64, key, debitKey string) error {
	funding.mutex.Lock()
	defer funding.mutex.Unlock()
	funding.calls++
	funding.refunds[key] = boostRefund{key: key, debitKey: debitKey, amountMinor: amountMinor}
	return nil
}

func withRecordingFunding(funding *recordingFunding) harnessOption {
	return func(collaborators *src.Collaborators, _ *configs.AdsSettings) { collaborators.Funding = funding }
}

func postDeletedEvent(postId string) []byte {
	return []byte(`{"id":"` + uuid.NewString() + `","type":"post.deleted","occurredAt":"2026-10-11T10:00:00Z","data":{"postId":"` + postId + `","kind":"post"}}`)
}

func (h *harness) deliver(body []byte) {
	h.t.Helper()
	if err := jobs.HandleDomainEventMessage(h.module.Container)(context.Background(), body); err != nil {
		h.t.Fatal(err)
	}
}

func (h *harness) relayBoostCancelledEvents(boostId uuid.UUID) int {
	h.t.Helper()
	rows, err := h.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("adBoost.cancelled"), outboxevent.Subject(boostId.String())).All(context.Background())
	if err != nil {
		h.t.Fatal(err)
	}
	for _, row := range rows {
		h.deliver(row.Payload)
	}
	return len(rows)
}

func (h *harness) boostRow(boostId string) *ent.AdBoost {
	return h.module.Container.Client.AdBoost.GetX(context.Background(), uuid.MustParse(boostId))
}

func (h *harness) serveBoostImpressions(boost *ent.AdBoost, count int, chargeMicros int64) {
	for index := 0; index < count; index++ {
		h.module.Container.Client.AdImpression.Create().SetID(uuid.Must(uuid.NewV7())).SetServedAt(h.clock.Now()).SetAdID(boost.AdID).SetAdGroupID(boost.AdGroupID).SetCampaignID(boost.CampaignID).
			SetAccountID(boost.AccountID).SetUserID("viewer").SetSessionID("s").SetPlacement("feed").SetSlotKind("feedPost").SetCurrency(boost.Currency).SetBasis(adimpression.BasisCpm).
			SetPriceMicros(chargeMicros).SetPctrPpm(0).SetChargeMicros(chargeMicros).SetPlatformShareMicros(chargeMicros).SaveX(context.Background())
	}
}

func TestDeletingABoostedPostCancelsTheBoostAndReturnsOnlyTheUnspentBudgetOnce(t *testing.T) {
	money := newFakeMoneyAccounts()
	funding := &recordingFunding{refunds: map[string]boostRefund{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withRecordingFunding(funding))
	owner, staff := h.newUser("ronke"), h.newUser("boostreviewer", "name:Rita", "perm:ads:review")
	money.levels[owner.id.String()] = 1
	body := boostBody("balance", 100_000, 3)
	created := h.expect("POST", "/api/v1/ads/boosts", &owner, "balance-boost-cancel-1", body, http.StatusCreated)
	boostId := created["boost"].(map[string]any)["id"].(string)
	boost := h.boostRow(boostId)
	h.expect("POST", "/api/v1/admin/ads/"+boost.AdID.String()+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	if boost = h.boostRow(boostId); boost.Status != adboost.StatusActive {
		t.Fatalf("approved boost should be active: %s", boost.Status)
	}
	h.serveBoostImpressions(boost, 3, 25_000_000_000)
	balanceBefore := h.module.Container.Client.AdAccount.GetX(context.Background(), boost.AccountID).BalanceMinor
	postId := body["postId"].(string)
	h.deliver(postDeletedEvent(postId))
	h.deliver(postDeletedEvent(postId))
	if boost = h.boostRow(boostId); boost.Status != adboost.StatusCancelled {
		t.Fatalf("deleting the post must cancel the boost: %s", boost.Status)
	}
	if events := h.relayBoostCancelledEvents(boost.ID); events != 1 {
		t.Fatalf("a duplicate post.deleted must not cancel twice: %d events", events)
	}
	h.relayBoostCancelledEvents(boost.ID)
	refund, found := funding.refunds["boost-cancel-"+boostId]
	if !found || refund.amountMinor != 300_000-75_000 || refund.debitKey != "balance-boost-cancel-1" || len(funding.refunds) != 1 {
		t.Fatalf("refund the unspent 225,000 against the original debit, under one key: %+v", funding.refunds)
	}
	if after := h.module.Container.Client.AdAccount.GetX(context.Background(), boost.AccountID).BalanceMinor; balanceBefore-after != 225_000 {
		t.Fatalf("the ad balance gives back exactly the refund once: before %d after %d", balanceBefore, after)
	}
	if rows := h.module.Container.Client.AdFundsTransaction.Query().Where(adfundstransaction.Reference("boostCancel:" + boostId)).CountX(context.Background()); rows != 1 {
		t.Fatalf("one refund row: %d", rows)
	}
	if status, refused := h.call("POST", "/api/v1/ads/boosts/"+boostId+"/cancel", &owner, "cancel-again-0001", map[string]any{}); status != http.StatusOK || refused["status"] != "cancelled" {
		t.Fatalf("cancelling a cancelled boost is a no-op: %d %v", status, refused)
	}
}

func TestBoostCancelledBeforeCardPaymentAndFinishedBoostsAreLeftAlone(t *testing.T) {
	money := newFakeMoneyAccounts()
	funding := &recordingFunding{refunds: map[string]boostRefund{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withRecordingFunding(funding))
	owner := h.newUser("kunle")
	body := boostBody("card", 100_000, 3)
	created := h.expect("POST", "/api/v1/ads/boosts", &owner, "card-boost-cancel-1", body, http.StatusCreated)
	boostId := created["boost"].(map[string]any)["id"].(string)
	h.deliver(postDeletedEvent(body["postId"].(string)))
	boost := h.boostRow(boostId)
	if boost.Status != adboost.StatusCancelled {
		t.Fatalf("an unpaid boost is cancelled: %s", boost.Status)
	}
	h.relayBoostCancelledEvents(boost.ID)
	if funding.calls != 0 {
		t.Fatal("nothing was paid, so nothing is refunded")
	}
	for range 2 {
		if err := (confirmboostpayment.Handler{Container: h.module.Container}).Execute(context.Background(), confirmboostpayment.Command{BoostId: boost.ID}); err != nil {
			t.Fatal(err)
		}
	}
	if balance := h.module.Container.Client.AdAccount.GetX(context.Background(), boost.AccountID).BalanceMinor; balance != 300_000 || h.boostRow(boostId).Status != adboost.StatusCancelled {
		t.Fatalf("a late card payment lands in the ad balance once and never restarts the boost: balance %d", balance)
	}
	finished := boostBody("card", 100_000, 3)
	done := h.expect("POST", "/api/v1/ads/boosts", &owner, "card-boost-done-01", finished, http.StatusCreated)
	doneId := done["boost"].(map[string]any)["id"].(string)
	h.module.Container.Client.AdBoost.UpdateOneID(uuid.MustParse(doneId)).SetStatus(adboost.StatusCompleted).ExecX(context.Background())
	h.deliver(postDeletedEvent(finished["postId"].(string)))
	if status := h.boostRow(doneId).Status; status != adboost.StatusCompleted {
		t.Fatalf("a finished boost stays finished: %s", status)
	}
	if status, refused := h.call("POST", "/api/v1/ads/boosts/"+doneId+"/cancel", &owner, "cancel-done-00001", map[string]any{}); status != http.StatusConflict || refused["code"] != "BOOST_NOT_CANCELLABLE" {
		t.Fatalf("owner cannot cancel a finished boost: %d %v", status, refused)
	}
	stranger := h.newUser("stranger")
	if status, _ := h.call("POST", "/api/v1/ads/boosts/"+doneId+"/cancel", &stranger, "cancel-stranger-01", map[string]any{}); status != http.StatusForbidden {
		t.Fatalf("only the owner may cancel: %d", status)
	}
}

func TestCancelledFreeBoostRestoresTheMonthlyAllowanceOnlyBeforeDelivery(t *testing.T) {
	money := newFakeMoneyAccounts()
	funding := &recordingFunding{refunds: map[string]boostRefund{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withRecordingFunding(funding))
	member := h.newUser("premium")
	money.premium[member.id.String()] = true
	undelivered := boostBody("free", 100_000, 1)
	first := h.expect("POST", "/api/v1/ads/boosts", &member, "free-boost-cancel-1", undelivered, http.StatusCreated)
	firstId := first["boost"].(map[string]any)["id"].(string)
	h.deliver(postDeletedEvent(undelivered["postId"].(string)))
	h.relayBoostCancelledEvents(uuid.MustParse(firstId))
	if allowance := h.expect("GET", "/api/v1/ads/boosts/options", &member, "", nil, http.StatusOK)["freeBoost"].(map[string]any); allowance["eligible"] != true {
		t.Fatalf("an undelivered free boost gives the month's allowance back: %v", allowance)
	}
	account := h.boostRow(firstId).AccountID
	if balance := h.module.Container.Client.AdAccount.GetX(context.Background(), account).BalanceMinor; balance != 0 || funding.calls != 0 {
		t.Fatalf("free credit is withdrawn, never refunded as money: balance %d, refunds %d", balance, funding.calls)
	}
	delivered := boostBody("free", 100_000, 1)
	second := h.expect("POST", "/api/v1/ads/boosts", &member, "free-boost-cancel-2", delivered, http.StatusCreated)
	secondId := second["boost"].(map[string]any)["id"].(string)
	h.serveBoostImpressions(h.boostRow(secondId), 1, 10_000_000)
	h.deliver(postDeletedEvent(delivered["postId"].(string)))
	if allowance := h.expect("GET", "/api/v1/ads/boosts/options", &member, "", nil, http.StatusOK)["freeBoost"].(map[string]any); allowance["eligible"] != false {
		t.Fatalf("a free boost that started delivering keeps the allowance used: %v", allowance)
	}
	if status := h.boostRow(secondId).Status; status != adboost.StatusCancelled {
		t.Fatalf("delivered free boost still cancelled: %s", status)
	}
}
