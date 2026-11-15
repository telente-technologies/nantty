package ads_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent/adimpression"
	"nantty/modules/ads/src/jobs"
	platformevents "nantty/platform/events"
)

func creatorProgramEvent(eventType, data string, occurredAt time.Time) []byte {
	return []byte(`{"id":"` + uuid.NewString() + `","type":"` + eventType + `","occurredAt":"` + occurredAt.UTC().Format(time.RFC3339) + `","data":` + data + `}`)
}

func TestCommentThreadAdsShareRevenueOnlyWithApprovedCreators(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	advertiser, viewer, staff := h.newUser("thread-advertiser"), h.newUser("thread-reader"), h.newUser("thread-reviewer", "perm:ads:review")
	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "thread-account", map[string]any{"name": "Thread Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	bundle := h.expect("POST", "/api/v1/ads/accounts/"+account["id"].(string)+"/campaigns", &advertiser, "thread-bundle", bundleFor(h.clock.Now().Add(-time.Hour).Format(time.RFC3339)), http.StatusCreated)
	adId := bundle["ads"].([]any)[0].(map[string]any)["id"].(string)
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	if err := h.module.Container.Client.AdAccount.UpdateOneID(mustParseUuid(t, account["id"].(string))).SetBalanceMinor(50_000_000).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	signal := func(postId, creatorId string, eligible bool) {
		if err := h.module.Container.Client.AdContentSignal.Create().SetContentID(postId).SetCreatorUserID(creatorId).SetContentKind("post").
			SetMonetizationEligible(eligible).SetOptedInPlacements([]string{}).SetTopics([]string{}).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	creatorOfServedImpression := func(postId string, slotIndex int) (string, string) {
		decision := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedCommentThread", "contentId": postId, "slotIndex": slotIndex}, "sessionId": "thread-" + postId}, http.StatusOK)
		served, _ := decision["ad"].(map[string]any)
		if served == nil {
			return "", decision["declinedReason"].(string)
		}
		if served["label"] != "Promoted" {
			t.Fatalf("comment ads are labelled Promoted: %v", served)
		}
		h.expect("POST", "/api/v1/ads/events", &viewer, "", map[string]any{"events": []any{map[string]any{"token": served["impressionToken"], "type": "impression"}}}, http.StatusOK)
		row, err := h.module.Container.Client.AdImpression.Query().Where(adimpression.ContentID(postId)).Only(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return row.CreatorUserID, ""
	}

	signal("post-free", "plain-user", false)
	if creator, declined := creatorOfServedImpression("post-free", 3); declined != "" || creator != "" {
		t.Fatalf("a non-creator's comment section still shows the ad but pays nobody: %q %q", creator, declined)
	}

	signal("post-approved", "approved-creator", false)
	h.deliver(creatorProgramEvent("creatorApplication.decided", `{"accountId":"approved-creator","applicationId":"a1","status":"approved"}`, h.clock.Now()))
	if creator, declined := creatorOfServedImpression("post-approved", 3); declined != "" || creator != "approved-creator" {
		t.Fatalf("the approved creator earns from their comment section: %q %q", creator, declined)
	}

	signal("post-suspended", "suspended-creator", true)
	h.deliver(creatorProgramEvent("creator.standingChanged", `{"userId":"suspended-creator","status":"suspended"}`, h.clock.Now()))
	h.deliver(creatorProgramEvent("creatorApplication.decided", `{"accountId":"suspended-creator","status":"approved"}`, h.clock.Now().Add(-time.Hour)))
	if creator, declined := creatorOfServedImpression("post-suspended", 3); declined != "" || creator != "" {
		t.Fatalf("a suspended creator earns nothing and a stale approval cannot undo it: %q %q", creator, declined)
	}

	signal("post-legacy", "legacy-creator", true)
	if creator, _ := creatorOfServedImpression("post-legacy", 3); creator != "legacy-creator" {
		t.Fatalf("creators approved before the projection existed keep earning via the content signal: %q", creator)
	}

	signal("post-gone", "approved-creator", true)
	h.deliver(postDeletedEvent("post-gone"))
	if _, declined := creatorOfServedImpression("post-gone", 3); declined != "content_removed" {
		t.Fatalf("a deleted post's comments show no ads: %q", declined)
	}

	malformed := creatorProgramEvent("creator.standingChanged", `{"userId":"x","status":"banana"}`, h.clock.Now())
	if err := jobs.HandleDomainEventMessage(h.module.Container)(ctx, malformed); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("an unknown standing is a poison message: %v", err)
	}
}
