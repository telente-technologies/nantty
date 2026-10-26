package getshippingsnapshot

import (
	"context"
	"time"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/shippingcalculation"
	"nantty/modules/orders/src/services"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

type Snapshot struct {
	OrderId          string       `json:"orderId"`
	Outcome          string       `json:"outcome"`
	Fee              money.Money  `json:"fee"`
	RuleId           *string      `json:"ruleId"`
	ZoneName         string       `json:"zoneName"`
	MatchedLevel     string       `json:"matchedLevel"`
	ThresholdApplied *money.Money `json:"thresholdApplied"`
	DestinationLabel string       `json:"destinationLabel"`
	OrderSubtotal    money.Money  `json:"orderSubtotal"`
	FeeCharged       money.Money  `json:"feeCharged"`
	CalculatedAt     time.Time    `json:"calculatedAt"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Snapshot, error) {
	group, err := services.LoadStoreOrder(ctx, handler.Container, query.StoreId, query.OrderId)
	if err != nil {
		return Snapshot{}, err
	}
	row, err := handler.Container.Client.ShippingCalculation.Query().Where(shippingcalculation.OrderGroupID(group.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return Snapshot{}, ordererrors.OrderNotFound
	}
	if err != nil {
		return Snapshot{}, err
	}
	currency := money.CurrencyCode(row.Currency)
	snapshot := Snapshot{
		OrderId: group.ID.String(), Outcome: row.Outcome, Fee: money.Money{AmountMinor: row.FeeMinor, Currency: currency}, ZoneName: row.ZoneName, MatchedLevel: row.MatchedLevel,
		DestinationLabel: row.DestinationLabel, OrderSubtotal: money.Money{AmountMinor: row.OrderSubtotalMinor, Currency: currency},
		FeeCharged: money.Money{AmountMinor: row.FeeMinor, Currency: currency}, CalculatedAt: row.CreatedAt,
	}
	if row.RuleID != nil {
		identifier := row.RuleID.String()
		snapshot.RuleId = &identifier
	}
	if row.ThresholdAppliedMinor != nil {
		snapshot.ThresholdApplied = &money.Money{AmountMinor: *row.ThresholdAppliedMinor, Currency: currency}
	}
	return snapshot, nil
}
