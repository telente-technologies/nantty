package services

import (
	"testing"

	"zudomart/modules/orders/src/enums"
)

func TestHappyPathWalksEveryStatusInOrder(t *testing.T) {
	path := []string{enums.StatusPending, enums.StatusNew, enums.StatusProcessing, enums.StatusReady, enums.StatusShipped, enums.StatusDelivered, enums.StatusCompleted}
	for index := 0; index < len(path)-1; index++ {
		if !CanTransition(path[index], path[index+1]) {
			t.Fatalf("%s -> %s should be allowed", path[index], path[index+1])
		}
	}
}

func TestForbiddenTransitions(t *testing.T) {
	cases := [][2]string{
		{enums.StatusPending, enums.StatusShipped}, {enums.StatusShipped, enums.StatusCancelled}, {enums.StatusCompleted, enums.StatusProcessing},
		{enums.StatusCancelled, enums.StatusNew}, {enums.StatusRefunded, enums.StatusCompleted}, {enums.StatusDelivered, enums.StatusShipped},
		{enums.StatusNew, enums.StatusDelivered}, {enums.StatusPending, enums.StatusDisputed},
	}
	for _, testCase := range cases {
		if CanTransition(testCase[0], testCase[1]) {
			t.Errorf("%s -> %s must be rejected", testCase[0], testCase[1])
		}
	}
}

func TestSellerCanReopenReadyOrdersAndDisputesRestoreStatus(t *testing.T) {
	if !CanTransition(enums.StatusReady, enums.StatusProcessing) || !CanTransition(enums.StatusDisputed, enums.StatusShipped) {
		t.Fatal("ready -> processing and disputed -> shipped must be allowed")
	}
}

func TestActorsOnlyDoTheirOwnTransitions(t *testing.T) {
	if ActorMayMoveTo(enums.ActorBuyer, enums.StatusShipped) || ActorMayMoveTo(enums.ActorBuyer, enums.StatusRefunded) {
		t.Fatal("buyers may only cancel")
	}
	if !ActorMayMoveTo(enums.ActorBuyer, enums.StatusCancelled) || ActorMayMoveTo(enums.ActorSeller, enums.StatusCompleted) {
		t.Fatal("seller must not complete orders; escrow does")
	}
	if !ActorMayMoveTo(enums.ActorSystem, enums.StatusCompleted) {
		t.Fatal("system completes orders when escrow releases")
	}
}

func TestDeliveryAndBuyerStatusMapping(t *testing.T) {
	if DeliveryStatusFor(enums.StatusShipped, "failed") != "failed" || DeliveryStatusFor(enums.StatusShipped, "pending") != "in_transit" {
		t.Fatal("shipped keeps a failed attempt visible")
	}
	if DeliveryStatusFor(enums.StatusCompleted, "") != "delivered" || DeliveryStatusFor(enums.StatusRefunded, "") != "cancelled" {
		t.Fatal("delivery mapping broken")
	}
	if BuyerStatusFor(enums.StatusProcessing) != "paid" || BuyerStatusFor(enums.StatusRefunded) != "cancelled" || BuyerStatusFor(enums.StatusDisputed) != "disputed" {
		t.Fatal("buyer status mapping broken")
	}
}
