package deletereview_test

import (
	"testing"

	deletereview "nantty/modules/catalog/src/modules/reviews/commands/deleteReview"
)

func TestDecrementRatingTotalsFloorsAtZero(t *testing.T) {
	sum, count := deletereview.DecrementRatingTotals(12, 3, 5)
	if sum != 7 || count != 2 {
		t.Fatalf("expected (7, 2), got (%d, %d)", sum, count)
	}
	flooredSum, flooredCount := deletereview.DecrementRatingTotals(3, 0, 5)
	if flooredSum != 0 || flooredCount != 0 {
		t.Fatalf("expected (0, 0) floor, got (%d, %d)", flooredSum, flooredCount)
	}
}
