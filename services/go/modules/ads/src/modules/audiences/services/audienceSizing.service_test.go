package services

import "testing"

func TestRoundToRangeNeverReturnsTheExactCountAndWidensAroundIt(t *testing.T) {
	for _, exact := range []int64{1, 99, 100, 437, 12_345, 987_654, 25_000_000} {
		lower, upper := RoundToRange(exact)
		if lower >= exact && exact > 100 || upper <= exact || lower == upper {
			t.Fatalf("exact %d produced %d-%d", exact, lower, upper)
		}
	}
	if lower, upper := RoundToRange(0); lower != 0 || upper != 100 {
		t.Fatalf("empty audience should round to 0-100, got %d-%d", lower, upper)
	}
}

func TestAudiencesBelowOneHundredPeopleAreTooSmallToTarget(t *testing.T) {
	if StatusForMatchedCount(99) != "too_small" || StatusForMatchedCount(100) != "ready" {
		t.Fatal("the targetable threshold is 100 matched people")
	}
}
