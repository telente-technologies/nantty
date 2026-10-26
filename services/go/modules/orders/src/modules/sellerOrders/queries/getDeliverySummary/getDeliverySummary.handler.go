package getdeliverysummary

import (
	"context"
	"math"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	listsellerorders "nantty/modules/orders/src/modules/sellerOrders/queries/listSellerOrders"
	listshipments "nantty/modules/orders/src/modules/sellerOrders/queries/listShipments"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

type Summary struct {
	CountsByStatus                map[string]int `json:"countsByStatus"`
	FeesCollectedLast30Days       money.Money    `json:"feesCollectedLast30Days"`
	AverageDeliveryDays           *float64       `json:"averageDeliveryDays"`
	FailedDeliveryRateBasisPoints int            `json:"failedDeliveryRateBasisPoints"`
	OnTimeRateBasisPoints         int            `json:"onTimeRateBasisPoints"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Summary, error) {
	rows, err := handler.Container.Client.OrderGroup.Query().Where(listsellerorders.PaidOrdersOfStore(query.StoreId)).
		Select(ordergroup.FieldDeliveryStatus, ordergroup.FieldShippingMinor, ordergroup.FieldCreatedAt, ordergroup.FieldStatus, ordergroup.FieldShippedAt,
			ordergroup.FieldDeliveredAt, ordergroup.FieldEstimatedDeliveryAt, ordergroup.FieldDeliveryAttempts).All(ctx)
	if err != nil {
		return Summary{}, err
	}
	summary := Summary{CountsByStatus: map[string]int{}, FeesCollectedLast30Days: money.Money{Currency: money.CurrencyCode(query.Currency)}}
	for _, status := range listshipments.PipelineStatuses {
		summary.CountsByStatus[status] = 0
	}
	since := handler.Container.Now().AddDate(0, 0, -30)
	var days float64
	delivered, failed, onTime, withEta := 0, 0, 0, 0
	for _, row := range rows {
		if _, tracked := summary.CountsByStatus[row.DeliveryStatus]; tracked {
			summary.CountsByStatus[row.DeliveryStatus]++
		}
		if row.Status != "cancelled" && row.Status != "refunded" && row.CreatedAt.After(since) {
			summary.FeesCollectedLast30Days.AmountMinor += row.ShippingMinor
		}
		if row.DeliveryStatus == "failed" {
			failed++
		}
		if row.DeliveredAt != nil && row.ShippedAt != nil {
			delivered++
			days += row.DeliveredAt.Sub(*row.ShippedAt).Hours() / 24
			if row.EstimatedDeliveryAt != nil {
				withEta++
				if !row.DeliveredAt.After(*row.EstimatedDeliveryAt) {
					onTime++
				}
			}
		}
	}
	if delivered > 0 {
		average := math.Round(days/float64(delivered)*10) / 10
		summary.AverageDeliveryDays = &average
	}
	if delivered+failed > 0 {
		summary.FailedDeliveryRateBasisPoints = failed * 10_000 / (delivered + failed)
	}
	if withEta > 0 {
		summary.OnTimeRateBasisPoints = onTime * 10_000 / withEta
	}
	return summary, nil
}
