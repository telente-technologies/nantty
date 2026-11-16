package services_test

import (
	"testing"

	"nantty/modules/orders/src/enums"
	orderservices "nantty/modules/orders/src/services"
)

func TestHappyPathWalksEveryStatusInOrder(t *testing.T) {
	path := []string{enums.StatusPending, enums.StatusNew, enums.StatusProcessing, enums.StatusReady, enums.StatusShipped, enums.StatusDelivered, enums.StatusCompleted}
	for index := 0; index < len(path)-1; index++ {
		if !orderservices.CanTransition(path[index], path[index+1]) {
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
		if orderservices.CanTransition(testCase[0], testCase[1]) {
			t.Errorf("%s -> %s must be rejected", testCase[0], testCase[1])
		}
	}
}

func TestSellerCanReopenReadyOrdersAndDisputesRestoreStatus(t *testing.T) {
	if !orderservices.CanTransition(enums.StatusReady, enums.StatusProcessing) || !orderservices.CanTransition(enums.StatusDisputed, enums.StatusShipped) {
		t.Fatal("ready -> processing and disputed -> shipped must be allowed")
	}
}

func TestActorsOnlyDoTheirOwnTransitions(t *testing.T) {
	if orderservices.ActorMayMoveTo(enums.ActorBuyer, enums.StatusShipped) || orderservices.ActorMayMoveTo(enums.ActorBuyer, enums.StatusRefunded) {
		t.Fatal("buyers may only cancel")
	}
	if !orderservices.ActorMayMoveTo(enums.ActorBuyer, enums.StatusCancelled) || orderservices.ActorMayMoveTo(enums.ActorSeller, enums.StatusCompleted) {
		t.Fatal("seller must not complete orders; escrow does")
	}
	if !orderservices.ActorMayMoveTo(enums.ActorSystem, enums.StatusCompleted) {
		t.Fatal("system completes orders when escrow releases")
	}
}

func TestDeliveryAndBuyerStatusMapping(t *testing.T) {
	if orderservices.DeliveryStatusFor(enums.StatusShipped, "failed") != "failed" || orderservices.DeliveryStatusFor(enums.StatusShipped, "pending") != "in_transit" {
		t.Fatal("shipped keeps a failed attempt visible")
	}
	if orderservices.DeliveryStatusFor(enums.StatusCompleted, "") != "delivered" || orderservices.DeliveryStatusFor(enums.StatusRefunded, "") != "cancelled" {
		t.Fatal("delivery mapping broken")
	}
	if orderservices.BuyerStatusFor(enums.StatusProcessing) != "paid" || orderservices.BuyerStatusFor(enums.StatusRefunded) != "cancelled" || orderservices.BuyerStatusFor(enums.StatusDisputed) != "disputed" {
		t.Fatal("buyer status mapping broken")
	}
}
