package escrow

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/generated/ent/escrowevent"
	"nantty/modules/escrow/src/modules/escrows/services"
)

func (harness *escrowHarness) reviewStartedAt(orderId string) *time.Time {
	harness.T.Helper()
	return harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background()).UndeliveredReviewAt
}

func (harness *escrowHarness) staffDecisionRecorded(orderId, staffId string) bool {
	harness.T.Helper()
	client := harness.escrow.Application.Container.Client(harness.Database)
	held := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	return client.EscrowEvent.Query().Where(escrowevent.EscrowID(held.ID), escrowevent.EventType("staffDecision"), escrowevent.ActorType("staff"), escrowevent.ActorID(staffId)).ExistX(context.Background())
}

func (harness *escrowHarness) sweep() int {
	harness.T.Helper()
	released, err := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10)
	if err != nil {
		harness.T.Fatalf("sweep: %v", err)
	}
	return released
}

func reviewQueueOrders(harness *escrowHarness, token string) []string {
	harness.T.Helper()
	page := harness.Call(http.MethodGet, "/api/v1/admin/escrows/undelivered-review", token, "", nil)
	if page.Status != http.StatusOK {
		harness.T.Fatalf("review queue: %d %s", page.Status, page.Raw)
	}
	var orders []string
	for _, row := range page.Body["data"].([]any) {
		orders = append(orders, row.(map[string]any)["orderId"].(string))
	}
	return orders
}

func TestAnUndeliveredEscrowGoesToStaffReviewAndIsNeverAutoReleasedOrAutoRefunded(t *testing.T) {
	harness := startEscrowHarness(t)
	window := harness.escrow.Application.Container.Settings.UndeliveredReleaseWindow()
	orders := map[string]string{"release": uuid.NewString(), "refund": uuid.NewString(), "lateDelivery": uuid.NewString(), "delivered": uuid.NewString()}
	for _, orderId := range orders {
		buyer := uuid.NewString()
		harness.registerCheckout(buyer, map[string]int64{orderId: 100_000})
		harness.payAndSettle(buyer, orderId)
	}
	heldAt := harness.clock.UTC()
	if deadline, _, _ := harness.escrowOf(orders["release"]); deadline == nil || (deadline.Sub(heldAt)-window).Abs() > time.Second {
		t.Fatalf("the review deadline is set at hold: %v", deadline)
	}
	harness.deliverOrderEvent("orderGroup.delivered", orders["delivered"], heldAt.Add(time.Hour).Truncate(time.Second))
	harness.clock = heldAt.Add(window + time.Minute)
	if released := harness.sweep(); released != 1 {
		t.Fatalf("only the delivered escrow is released by the sweep: %d", released)
	}
	for _, name := range []string{"release", "refund", "lateDelivery"} {
		deadline, _, status := harness.escrowOf(orders[name])
		if status != "held" || deadline != nil || harness.reviewStartedAt(orders[name]) == nil {
			t.Fatalf("%s: an undelivered escrow moves to staff review: %s %v %v", name, status, deadline, harness.reviewStartedAt(orders[name]))
		}
	}
	var underReview int
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "` + harness.escrow.Application.Container.Settings.Money.DatabaseSchema + `".outbox_events WHERE event_type = 'escrow.underReview'`).Scan(&underReview)
	if underReview != 3 {
		t.Fatal("buyer and seller are told the order is under review")
	}
	harness.clock = harness.clock.Add(365 * 24 * time.Hour)
	if released := harness.sweep(); released != 0 {
		t.Fatalf("an escrow under review is never auto-released: %d", released)
	}
	staffId := uuid.NewString()
	staff := harness.Tokens.StaffTokens(staffId, "money.disputes.resolve")
	if queued := reviewQueueOrders(harness, staff.AccessToken); len(queued) != 3 {
		t.Fatalf("review queue: %v", queued)
	}
	if stranger := harness.Call(http.MethodGet, "/api/v1/admin/escrows/undelivered-review", harness.Tokens.UserAccessToken(uuid.NewString()), "", nil); stranger.Status == http.StatusOK {
		t.Fatalf("the queue is staff-only: %d", stranger.Status)
	}
	releaseUrl := "/api/v1/admin/orders/" + orders["release"] + "/escrow/release"
	if noStepUp := harness.Call(http.MethodPost, releaseUrl, staff.AccessToken, "review-release-1", map[string]any{"reason": "Seller showed proof of delivery"}); noStepUp.Status != http.StatusForbidden {
		t.Fatalf("release needs step-up: %d", noStepUp.Status)
	}
	if noReason := harness.Call(http.MethodPost, releaseUrl, staff.AccessToken, "review-release-2", map[string]any{"reason": ""}, staff.StepUp()); noReason.Status != http.StatusBadRequest {
		t.Fatalf("release needs a reason: %d", noReason.Status)
	}
	released := harness.Call(http.MethodPost, releaseUrl, staff.AccessToken, "review-release-3", map[string]any{"reason": "Seller showed proof of delivery"}, staff.StepUp())
	replayed := harness.Call(http.MethodPost, releaseUrl, staff.AccessToken, "review-release-3", map[string]any{"reason": "Seller showed proof of delivery"}, staff.StepUp())
	if released.Status != http.StatusOK || replayed.Status != http.StatusOK || released.Body["status"] != "released" {
		t.Fatalf("staff release: %d %s / %d", released.Status, released.Raw, replayed.Status)
	}
	refunded := harness.Call(http.MethodPost, "/api/v1/admin/orders/"+orders["refund"]+"/escrow/refund", staff.AccessToken, "review-refund-1", map[string]any{"reason": "Seller never shipped"}, staff.StepUp())
	if refunded.Status != http.StatusOK || refunded.Body["status"] != "refunded" {
		t.Fatalf("staff refund: %d %s", refunded.Status, refunded.Raw)
	}
	for _, name := range []string{"release", "refund"} {
		if !harness.staffDecisionRecorded(orders[name], staffId) {
			t.Fatalf("%s: the staff decision and reason are audited", name)
		}
	}
	lateDeliveredAt := harness.clock.Truncate(time.Second)
	harness.deliverOrderEvent("orderGroup.delivered", orders["lateDelivery"], lateDeliveredAt)
	if deadline, _, status := harness.escrowOf(orders["lateDelivery"]); status != "held" || deadline == nil || !deadline.Equal(lateDeliveredAt.Add(72*time.Hour)) || harness.reviewStartedAt(orders["lateDelivery"]) != nil {
		t.Fatalf("a delivery before staff act returns to the normal 3-day release: %s %v", status, deadline)
	}
	if queued := reviewQueueOrders(harness, staff.AccessToken); len(queued) != 0 {
		t.Fatalf("settled and delivered escrows leave the queue: %v", queued)
	}
	harness.clock = lateDeliveredAt.Add(72*time.Hour + time.Minute)
	if released := harness.sweep(); released != 1 {
		t.Fatalf("the late-delivered escrow auto-releases after inspection: %d", released)
	}
	harness.AssertLedgerHealthy()
}

func TestTheBackfillGivesLegacyHeldEscrowsAReviewDeadlineOnceAndOnlyWhenApplied(t *testing.T) {
	harness := startEscrowHarness(t)
	legacy, delivered := uuid.NewString(), uuid.NewString()
	for _, orderId := range []string{legacy, delivered} {
		buyer := uuid.NewString()
		harness.registerCheckout(buyer, map[string]int64{orderId: 100_000})
		harness.payAndSettle(buyer, orderId)
	}
	harness.deliverOrderEvent("orderGroup.delivered", delivered, harness.clock.UTC().Truncate(time.Second))
	settings := harness.escrow.Application.Container.Settings
	schema := settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`UPDATE "`+schema+`".escrows SET auto_release_at = NULL WHERE order_id = $1`, legacy); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if count, err := services.BackfillUndeliveredReviewDeadlines(ctx, harness.Database, schema, settings.UndeliveredReleaseWindow(), true); err != nil || count != 1 {
		t.Fatalf("dry run counts only the legacy escrow: %d %v", count, err)
	}
	if deadline, _, _ := harness.escrowOf(legacy); deadline != nil {
		t.Fatalf("a dry run writes nothing: %v", deadline)
	}
	if count, err := services.BackfillUndeliveredReviewDeadlines(ctx, harness.Database, schema, settings.UndeliveredReleaseWindow(), false); err != nil || count != 1 {
		t.Fatalf("apply: %d %v", count, err)
	}
	created := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(legacy)).OnlyX(ctx).CreatedAt
	if deadline, _, _ := harness.escrowOf(legacy); deadline == nil || !deadline.Equal(created.Add(settings.UndeliveredReleaseWindow())) {
		t.Fatalf("deadline is hold + window: %v", deadline)
	}
	if count, _ := services.BackfillUndeliveredReviewDeadlines(ctx, harness.Database, schema, settings.UndeliveredReleaseWindow(), false); count != 0 {
		t.Fatalf("the backfill is idempotent: %d", count)
	}
	harness.clock = created.Add(settings.UndeliveredReleaseWindow() + time.Minute)
	harness.sweep()
	if _, _, status := harness.escrowOf(legacy); status != "held" || harness.reviewStartedAt(legacy) == nil {
		t.Fatalf("a backfilled escrow goes to staff review, not to the seller: %s", status)
	}
}
