package ads

import (
	"context"
	"net/http"
	"testing"

	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adboost"
)

func (h *harness) rejectBoostAd(staff *testUser, adId string, wantStatus int) {
	h.t.Helper()
	category := h.module.Container.Client.AdPolicyCategory.Query().FirstX(context.Background())
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/reject", staff, "", map[string]any{"policyCategoryId": category.ID.String(), "reason": "Misleading claim in the post"}, wantStatus)
}

func TestRejectingABoostNeverCreditsItsBudgetTwice(t *testing.T) {
	money := newFakeMoneyAccounts()
	funding := &recordingFunding{refunds: map[string]boostRefund{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withRecordingFunding(funding))
	owner, staff := h.newUser("adaeze"), h.newUser("rejectreviewer", "name:Rita", "perm:ads:review")
	money.levels[owner.id.String()] = 1
	ctx := context.Background()
	balanceOf := func(boostId string) int64 {
		return h.module.Container.Client.AdAccount.GetX(ctx, h.boostRow(boostId).AccountID).BalanceMinor
	}

	inReview := h.expect("POST", "/api/v1/ads/boosts", &owner, "reject-twice-00001", boostBody("balance", 100_000, 3), http.StatusCreated)
	inReviewId := inReview["boost"].(map[string]any)["id"].(string)
	if balance := balanceOf(inReviewId); balance != 300_000 {
		t.Fatalf("creation credits the budget once: %d", balance)
	}
	h.rejectBoostAd(&staff, h.boostRow(inReviewId).AdID.String(), http.StatusOK)
	h.rejectBoostAd(&staff, h.boostRow(inReviewId).AdID.String(), http.StatusConflict)
	if balance, status := balanceOf(inReviewId), h.boostRow(inReviewId).Status; balance != 300_000 || status != adboost.StatusRejected {
		t.Fatalf("rejection must not add a second credit: balance %d, status %s", balance, status)
	}

	delivering := h.expect("POST", "/api/v1/ads/boosts", &owner, "reject-partial-001", boostBody("balance", 100_000, 3), http.StatusCreated)
	deliveringId := delivering["boost"].(map[string]any)["id"].(string)
	boost := h.boostRow(deliveringId)
	h.expect("POST", "/api/v1/admin/ads/"+boost.AdID.String()+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	h.serveBoostImpressions(h.boostRow(deliveringId), 2, 10_000_000_000)
	before := balanceOf(deliveringId)
	h.module.Container.Client.Ad.UpdateOneID(boost.AdID).SetReviewStatus(ad.ReviewStatusPending).ExecX(ctx)
	h.rejectBoostAd(&staff, boost.AdID.String(), http.StatusOK)
	if after, status := balanceOf(deliveringId), h.boostRow(deliveringId).Status; after != before || status != adboost.StatusRejected {
		t.Fatalf("rejecting after partial delivery leaves the balance alone: before %d after %d, status %s", before, after, status)
	}
	if funding.calls != 0 {
		t.Fatalf("rejection keeps paid budgets in the ad balance: %d refunds", funding.calls)
	}

	money.premium[owner.id.String()] = true
	free := h.expect("POST", "/api/v1/ads/boosts", &owner, "reject-free-boost1", boostBody("free", 100_000, 1), http.StatusCreated)
	freeId := free["boost"].(map[string]any)["id"].(string)
	creditOf := func(boostId string) int64 {
		return h.module.Container.Client.AdAccount.GetX(ctx, h.boostRow(boostId).AccountID).CreditMinor
	}
	freeBefore, balanceBefore := creditOf(freeId), balanceOf(freeId)
	h.rejectBoostAd(&staff, h.boostRow(freeId).AdID.String(), http.StatusOK)
	if after := creditOf(freeId); freeBefore-after != 100_000 || balanceOf(freeId) != balanceBefore {
		t.Fatalf("a rejected free boost withdraws its free ad credit and never touches the real balance: credit before %d after %d", freeBefore, after)
	}
	if allowance := h.expect("GET", "/api/v1/ads/boosts/options", &owner, "", nil, http.StatusOK)["freeBoost"].(map[string]any); allowance["eligible"] != true {
		t.Fatalf("an undelivered rejected free boost gives the allowance back: %v", allowance)
	}
}
