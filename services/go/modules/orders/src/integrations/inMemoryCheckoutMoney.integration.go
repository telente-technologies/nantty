package integrations

import (
	"context"
	"sync"
	"time"

	"nantty/modules/orders/src/interfaces"
)

type InMemoryCheckoutMoney struct {
	mutex     sync.Mutex
	Payables  map[string]interfaces.OrderPayable
	Delivered map[string]bool
	Confirmed map[string]bool
	Fail      error
	Window    time.Duration
}

func NewInMemoryCheckoutMoney() *InMemoryCheckoutMoney {
	return &InMemoryCheckoutMoney{Payables: map[string]interfaces.OrderPayable{}, Delivered: map[string]bool{}, Confirmed: map[string]bool{}, Window: 72 * time.Hour}
}

func (fake *InMemoryCheckoutMoney) RegisterCheckoutPayables(_ context.Context, request interfaces.RegisterPayablesRequest) error {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if fake.Fail != nil {
		return fake.Fail
	}
	for _, order := range request.Orders {
		fake.Payables[order.OrderId] = order
	}
	return nil
}

func (fake *InMemoryCheckoutMoney) RecordOrderFulfilment(_ context.Context, record interfaces.FulfilmentRecord) (interfaces.EscrowSummary, error) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	summary := interfaces.EscrowSummary{OrderId: record.OrderId, Status: "held"}
	if record.Delivered {
		fake.Delivered[record.OrderId] = true
		release := record.OccurredAt.Add(fake.Window)
		summary.AutoReleaseAt = &release
	}
	return summary, nil
}

func (fake *InMemoryCheckoutMoney) ConfirmOrderReceipt(_ context.Context, orderId, _ string) (interfaces.EscrowSummary, error) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.Confirmed[orderId] = true
	return interfaces.EscrowSummary{OrderId: orderId, Status: "released"}, nil
}

func (fake *InMemoryCheckoutMoney) GetOrderEscrow(_ context.Context, orderId string) (interfaces.EscrowSummary, error) {
	return interfaces.EscrowSummary{OrderId: orderId, Status: "held"}, nil
}
