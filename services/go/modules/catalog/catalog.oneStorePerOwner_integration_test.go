package catalog

import (
	"fmt"
	"net/http"
	"sync"
	"testing"
)

func TestTheDatabaseKeepsOneOpenStorePerOwnerEvenWhenChecksRace(t *testing.T) {
	harness := startHttpHarness(t)
	registry, directory := startProfileRuleHarness(harness)
	registry.allowAll = true
	ownerId, owner := harness.account("racing-owner")
	results := make([]int, 6)
	codes := make([]any, 6)
	var group sync.WaitGroup
	for index := range results {
		page := directory.addBusiness(ownerId)
		group.Add(1)
		go func() {
			defer group.Done()
			var body map[string]any
			results[index], body = harness.call("POST", "/api/v1/stores", owner, map[string]any{"businessProfileId": page.String(), "name": fmt.Sprintf("Race Shop %d", index)}, "Idempotency-Key", fmt.Sprintf("store-race-%08d", index))
			codes[index] = body["code"]
		}()
	}
	group.Wait()
	created := 0
	for index, status := range results {
		switch {
		case status == http.StatusCreated:
			created++
		case status != http.StatusConflict || codes[index] != "STORE_LIMIT_ONE":
			t.Fatalf("a losing store create is refused with STORE_LIMIT_ONE: %d %v", status, codes[index])
		}
	}
	if created != 1 {
		t.Fatalf("exactly one store per owner: %v", results)
	}
}
