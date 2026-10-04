package services

import (
	"testing"

	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

func planWithStores(verified ...bool) (CheckoutPlan, []uuid.UUID) {
	plan, ids := CheckoutPlan{}, []uuid.UUID{}
	for _, flag := range verified {
		id := uuid.New()
		ids = append(ids, id)
		plan.Groups = append(plan.Groups, PlannedGroup{Group: SellerGroup{StoreId: id}, Store: commerceports.StoreSnapshot{Verified: flag}})
	}
	return plan, ids
}

func TestResolvePaymentModesDefaultsToEscrow(t *testing.T) {
	plan, _ := planWithStores(true, false)
	if err := ResolvePaymentModes(&plan, nil); err != nil {
		t.Fatal(err)
	}
	for _, group := range plan.Groups {
		if group.PaymentMode != "escrow" {
			t.Fatalf("got %s", group.PaymentMode)
		}
	}
}

func TestResolvePaymentModesDirectForVerifiedOnly(t *testing.T) {
	plan, ids := planWithStores(true, false)
	if err := ResolvePaymentModes(&plan, map[uuid.UUID]string{ids[0]: "direct", ids[1]: "escrow"}); err != nil {
		t.Fatal(err)
	}
	if plan.Groups[0].PaymentMode != "direct" || plan.Groups[1].PaymentMode != "escrow" {
		t.Fatalf("modes %s %s", plan.Groups[0].PaymentMode, plan.Groups[1].PaymentMode)
	}
	if err := ResolvePaymentModes(&plan, map[uuid.UUID]string{ids[1]: "direct"}); err == nil {
		t.Fatal("unverified store must reject direct")
	}
	if err := ResolvePaymentModes(&plan, map[uuid.UUID]string{ids[0]: "cash"}); err == nil {
		t.Fatal("unknown mode must be rejected")
	}
}
