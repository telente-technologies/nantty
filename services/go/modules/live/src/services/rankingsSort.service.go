package services

import (
	"sort"

	"github.com/google/uuid"
)

func sortTotalsDescending(totals []struct {
	UserID uuid.UUID `json:"user_id"`
	Total  int64     `json:"total"`
}) {
	sort.Slice(totals, func(left, right int) bool {
		if totals[left].Total != totals[right].Total {
			return totals[left].Total > totals[right].Total
		}
		return totals[left].UserID.String() < totals[right].UserID.String()
	})
}
