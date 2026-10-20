package creators

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func (scene *affiliateWorkspaceScene) linkClicks() float64 {
	_, promotions := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-promotions", scene.creatorToken, "", nil)
	return promotions["data"].([]any)[0].(map[string]any)["clicks"].(float64)
}

func TestAffiliateClicksCountOncePerViewerPerDayWithoutStoringRawIdentifiers(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	clock := time.Now().UTC()
	scene.module.Container.Now = func() time.Time { return clock }
	path := "/api/v1/affiliate-links/" + scene.linkId + "/clicks"
	buyerToken := scene.tokens.UserAccessToken(scene.buyer)
	for range 3 {
		scene.call(http.MethodPost, path, buyerToken, "", nil)
		scene.call(http.MethodPost, path, "", "", map[string]any{"visitorId": "device-aaaa-1111"})
		scene.call(http.MethodPost, path, "", "", nil)
		scene.call(http.MethodPost, path, scene.creatorToken, "", nil)
	}
	if clicks := scene.linkClicks(); clicks != 3 {
		t.Fatalf("one signed-in viewer, one app device and one browser count once each, the creator never: %v", clicks)
	}
	scene.call(http.MethodPost, path, "", "", map[string]any{"visitorId": "device-bbbb-2222"})
	clock = clock.Add(23 * time.Hour)
	scene.call(http.MethodPost, path, buyerToken, "", nil)
	if clicks := scene.linkClicks(); clicks != 4 {
		t.Fatalf("a new device counts, the same viewer inside 24 hours does not: %v", clicks)
	}
	clock = clock.Add(time.Hour)
	scene.call(http.MethodPost, path, buyerToken, "", nil)
	scene.call(http.MethodPost, path, "", "", map[string]any{"visitorId": "device-aaaa-1111"})
	if clicks := scene.linkClicks(); clicks != 6 {
		t.Fatalf("after 24 hours the same viewers count again: %v", clicks)
	}
	var stored int
	if err := scene.database.QueryRow(`SELECT COUNT(*) FROM `+scene.module.Container.Settings.Money.DatabaseSchema+`.affiliate_link_visits WHERE viewer_key = $1 OR viewer_key LIKE '%device%' OR length(viewer_key) <> 64`, scene.buyer).Scan(&stored); err != nil || stored != 0 {
		t.Fatalf("only 64-character digests are stored as viewer keys: %d %v", stored, err)
	}
}

func TestACancellationProcessedBeforeThePaidEventLeavesNothingPending(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	for _, ending := range []string{"cancelled", "refunded"} {
		orderId := uuid.NewString()
		scene.changeStatus(orderId, "new", ending)
		if recorded := scene.record(scene.paid(orderId, scene.buyer, scene.item(orderId+":1", scene.productId, "link", scene.linkId, time.Now()))); recorded != 0 || scene.saleStatus(orderId) != "none" {
			t.Fatalf("%s before paid: recorded %d, sale %s", ending, recorded, scene.saleStatus(orderId))
		}
	}
	_, pending := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-earnings?status=pending", scene.creatorToken, "", nil)
	if rows := pending["data"].([]any); len(rows) != 0 {
		t.Fatalf("no stale pending sales: %v", rows)
	}
}

func TestConcurrentPaidAndCancelEventsNeverLeaveAPendingSale(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	for range 10 {
		orderId := uuid.NewString()
		paid := scene.paid(orderId, scene.buyer, scene.item(orderId+":1", scene.productId, "link", scene.linkId, time.Now()))
		done := make(chan error, 2)
		go func() {
			_, err := scene.module.Affiliates.RecordAwaitingAttributedSales(context.Background(), paid.Sale())
			done <- err
		}()
		go func() {
			_, err := scene.module.Affiliates.VoidAwaitingAttributedSales(context.Background(), orderId, "cancelled")
			done <- err
		}()
		for range 2 {
			if err := <-done; err != nil {
				t.Fatal(err)
			}
		}
		if status := scene.saleStatus(orderId); status == "awaiting:" {
			t.Fatalf("a cancelled order kept a pending sale")
		}
	}
}
