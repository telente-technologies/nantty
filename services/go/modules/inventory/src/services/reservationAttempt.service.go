package services

import (
	"context"
	"fmt"

	"zudomart/modules/inventory/src/enums"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stockreservation"
)

func reservationMovementReference(reference string, attempt int) string {
	if attempt == 0 {
		return reference
	}
	return fmt.Sprintf("%s#attempt%d", reference, attempt)
}

func rowsOfLatestAttempt(rows []*ent.StockReservation) []*ent.StockReservation {
	latest := 0
	for _, row := range rows {
		latest = max(latest, row.Attempt)
	}
	current := make([]*ent.StockReservation, 0, len(rows))
	for _, row := range rows {
		if row.Attempt == latest {
			current = append(current, row)
		}
	}
	return current
}

func nextReservationAttempt(ctx context.Context, tx *ent.Tx, reference string) (int, bool, error) {
	previous, err := tx.StockReservation.Query().Where(stockreservation.Reference(reference)).All(ctx)
	if err != nil || len(previous) == 0 {
		return 0, false, err
	}
	latest := rowsOfLatestAttempt(previous)
	for _, row := range latest {
		if row.Status == enums.ReservationFulfilled {
			return 0, true, nil
		}
	}
	return latest[0].Attempt + 1, false, nil
}
