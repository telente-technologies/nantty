package services

import (
	"context"
	"math"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/predicate"
	"zudomart/modules/orders/src/generated/ent/storesuccessstat"
)

const (
	SuccessRateMinimumOrders = 20
	SuccessRateWindowDays    = 90
)

func CalculateSuccessRate(settled, successful int) *float64 {
	if settled < SuccessRateMinimumOrders || successful < 0 || successful > settled {
		return nil
	}
	rate := math.Round(float64(successful)/float64(settled)*1000) / 1000
	return &rate
}

type storeOrderCount struct {
	StoreID uuid.UUID `json:"store_id"`
	Count   int       `json:"count"`
}

func RefreshStoreSuccessStats(ctx context.Context, deployed *container.Container) error {
	now := deployed.Now()
	settledWhere := []predicate.OrderGroup{
		ordergroup.CreatedAtGTE(now.AddDate(0, 0, -SuccessRateWindowDays)), ordergroup.PaymentStatusNEQ(enums.PaymentPending),
		ordergroup.StatusIn(enums.StatusCompleted, enums.StatusRefunded, enums.StatusReturned, enums.StatusCancelled),
	}
	settled, err := countByStore(ctx, deployed, settledWhere)
	if err != nil {
		return err
	}
	successful, err := countByStore(ctx, deployed, append(settledWhere[:3:3], ordergroup.Status(enums.StatusCompleted), ordergroup.RefundedMinor(0)))
	if err != nil {
		return err
	}
	rows := make([]*ent.StoreSuccessStatCreate, 0, len(settled))
	for storeId, total := range settled {
		rows = append(rows, deployed.Client.StoreSuccessStat.Create().SetStoreID(storeId).SetSettledOrders(total).SetSuccessfulOrders(successful[storeId]).SetComputedAt(now))
	}
	for start := 0; start < len(rows); start += 500 {
		batch := rows[start:min(start+500, len(rows))]
		if err := deployed.Client.StoreSuccessStat.CreateBulk(batch...).OnConflictColumns(storesuccessstat.FieldStoreID).
			Update(func(upsert *ent.StoreSuccessStatUpsert) {
				upsert.UpdateSettledOrders().UpdateSuccessfulOrders().UpdateComputedAt()
			}).Exec(ctx); err != nil {
			return err
		}
	}
	_, err = deployed.Client.StoreSuccessStat.Delete().Where(storesuccessstat.ComputedAtLT(now)).Exec(ctx)
	return err
}

func countByStore(ctx context.Context, deployed *container.Container, conditions []predicate.OrderGroup) (map[uuid.UUID]int, error) {
	var counted []storeOrderCount
	if err := deployed.Client.OrderGroup.Query().Where(conditions...).GroupBy(ordergroup.FieldStoreID).Aggregate(ent.Count()).Scan(ctx, &counted); err != nil {
		return nil, err
	}
	byStore := make(map[uuid.UUID]int, len(counted))
	for _, row := range counted {
		byStore[row.StoreID] = row.Count
	}
	return byStore, nil
}

func StoreSuccessRates(ctx context.Context, deployed *container.Container, storeIds []uuid.UUID) (map[uuid.UUID]float64, error) {
	rows, err := deployed.Client.StoreSuccessStat.Query().Where(storesuccessstat.StoreIDIn(storeIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	rates := map[uuid.UUID]float64{}
	for _, row := range rows {
		if rate := CalculateSuccessRate(row.SettledOrders, row.SuccessfulOrders); rate != nil {
			rates[row.StoreID] = *rate
		}
	}
	return rates, nil
}
