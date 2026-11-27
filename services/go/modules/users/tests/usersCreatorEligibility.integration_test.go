package users_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/users/src/generated/ent/creatorapplication"
)

func TestCreatorProgramDecisionsFollowTheAdminThresholds(t *testing.T) {
	cases := []struct {
		name              string
		signals           map[string]any
		realFollowers     int
		verifiedFollowers int
		impressions       int
		wantDecision      string
		wantStatus        string
	}{
		{"every threshold met is approved automatically", map[string]any{"originalPostsLast60Days": 12, "daysSinceLastViolation": 400, "fraudScore": 10}, 12_000, 700, 120_000, "auto_approve", "approved"},
		{"past violation with thresholds goes to manual review", map[string]any{"originalPostsLast60Days": 12, "daysSinceLastViolation": 20, "riskScore": 20}, 12_000, 700, 120_000, "manual_review", "pending"},
		{"high fraud with thresholds goes to manual review", map[string]any{"originalPostsLast60Days": 12, "daysSinceLastViolation": 400, "fraudScore": 55, "riskScore": 40}, 12_000, 700, 120_000, "manual_review", "pending"},
		{"below the real follower floor is not eligible", map[string]any{}, 9_999, 700, 120_000, "not_eligible", "rejected"},
		{"below the verified follower floor is not eligible", map[string]any{}, 12_000, 499, 120_000, "not_eligible", "rejected"},
		{"below qualifying impressions is not eligible", map[string]any{}, 12_000, 700, 99_999, "not_eligible", "rejected"},
		{"risk above review limit is not eligible", map[string]any{"riskScore": 80}, 12_000, 700, 120_000, "not_eligible", "rejected"},
		{"missing analytics snapshot does not create a false rejection", map[string]any{"originalPostsLast60Days": 12, "daysSinceLastViolation": 400}, 0, 0, 0, "unavailable", "unavailable"},
	}
	for index, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			harness := startUsersModuleAgainstFreshSchema(t)
			username := "creator.case" + string(rune('a'+index))
			accountId, token := harness.newAccount(username, "Creator Case")
			profileId := harness.profileIdOf(token)
			if testCase.realFollowers > 0 {
				harness.putCreatorMetrics(profileId, testCase.realFollowers, testCase.verifiedFollowers, testCase.impressions)
			}
			signals := make(map[string]any, len(testCase.signals)+1)
			for key, value := range testCase.signals {
				signals[key] = value
			}
			if _, hasStanding := signals["daysSinceLastViolation"]; !hasStanding {
				signals["daysSinceLastViolation"] = 180
			}
			harness.putSignals(profileId, signals)
			eligibility := harness.expect("GET", "/api/v1/creators/eligibility", token, nil, http.StatusOK)
			if eligibility["decision"] != testCase.wantDecision || len(eligibility["requirements"].([]any)) != 7 {
				t.Fatalf("unexpected eligibility %v", eligibility)
			}
			if testCase.wantStatus == "unavailable" {
				harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{
					"contentCategories": []string{"tech"}, "socialLinks": []any{}, "sampleContentUrls": []string{}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1",
				}, http.StatusServiceUnavailable, "Idempotency-Key", "creator-case-key-0001")
				count, err := harness.module.Container().Client.CreatorApplication.Query().Where(creatorapplication.AccountID(mustParseUuid(accountId))).Count(context.Background())
				if err != nil || count != 0 {
					t.Fatalf("unavailable trusted metrics must not persist an application or reapply cooldown: count=%d err=%v", count, err)
				}
				return
			}
			application := harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{
				"contentCategories": []string{"tech"}, "socialLinks": []any{}, "sampleContentUrls": []string{}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1",
			}, http.StatusCreated, "Idempotency-Key", "creator-case-key-0001")
			if application["status"] != testCase.wantStatus {
				t.Fatalf("unexpected application %v", application)
			}
			if testCase.wantStatus == "rejected" {
				if application["reapplyAvailableAt"] == nil || application["rejectionReason"] == nil {
					t.Fatalf("a rejected application explains why and when to try again: %v", application)
				}
				harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusConflict, "Idempotency-Key", "creator-case-key-0002")
			}
			me := harness.expect("GET", "/api/v1/users/me", token, nil, http.StatusOK)
			if (me["creatorStatus"] == "approved") != (testCase.wantStatus == "approved") {
				t.Fatalf("creator status lives on the personal profile: %v", me)
			}
		})
	}
}

func TestCreatorMetricsSnapshotsAreTrustedIdempotentAndMonotonic(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("creator.metrics", "Creator Metrics")
	profileId := harness.profileIdOf(token)
	base := time.Now().UTC().Add(-time.Minute)
	snapshotId := uuid.NewString()
	request := map[string]any{"realFollowers": 12_000, "verifiedFollowers": 700, "qualifyingImpressionsLast30Days": 120_000, "originalPostsLast60Days": 12, "creatorMetricsSnapshotId": snapshotId, "creatorMetricsAsOf": base.Format(time.RFC3339Nano), "source": "analytics_creator_eligibility_v1"}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", request, http.StatusUnauthorized, internalToken...)
	validHeaders := []string{"X-Internal-Token", strings.Repeat("u", 32), "X-Creator-Metrics-Token", strings.Repeat("c", 32)}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", request, http.StatusNoContent, validHeaders...)
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", request, http.StatusNoContent, validHeaders...)
	var snapshots int
	if err := harness.module.Container().Database.QueryRowContext(context.Background(), "SELECT count(*) FROM creator_eligibility_metric_snapshots WHERE profile_id = $1", mustParseUuid(profileId)).Scan(&snapshots); err != nil || snapshots != 1 {
		t.Fatalf("exact snapshot replay should persist once: rows=%d err=%v", snapshots, err)
	}
	conflictingReplay := map[string]any{"realFollowers": 12_001, "verifiedFollowers": 700, "qualifyingImpressionsLast30Days": 120_000, "originalPostsLast60Days": 12, "creatorMetricsSnapshotId": snapshotId, "creatorMetricsAsOf": base.Format(time.RFC3339Nano), "source": "analytics_creator_eligibility_v1"}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", conflictingReplay, http.StatusConflict, validHeaders...)
	stale := map[string]any{"realFollowers": 13_000, "verifiedFollowers": 701, "qualifyingImpressionsLast30Days": 121_000, "originalPostsLast60Days": 12, "creatorMetricsSnapshotId": uuid.NewString(), "creatorMetricsAsOf": base.Add(-time.Second).Format(time.RFC3339Nano), "source": "analytics_creator_eligibility_v1"}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", stale, http.StatusConflict, validHeaders...)
}

func TestCreatorMetricsReplayDoesNotSkipNewPolicyStanding(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("creator.metrics-standing", "Creator Metrics Standing")
	profileId := harness.profileIdOf(token)
	metricsAt := time.Now().UTC().Add(-time.Minute)
	standingAt := time.Now().UTC()
	metricId, standingId := uuid.NewString(), uuid.NewString()
	input := map[string]any{"realFollowers": 12_000, "verifiedFollowers": 700, "qualifyingImpressionsLast30Days": 120_000, "originalPostsLast60Days": 12, "creatorMetricsSnapshotId": metricId, "creatorMetricsAsOf": metricsAt.Format(time.RFC3339Nano), "source": "analytics_creator_eligibility_v1", "daysSinceLastViolation": 180, "creatorStandingSnapshotId": standingId, "creatorStandingSource": "moderation_creator_standing_v1", "creatorStandingAsOf": standingAt.Format(time.RFC3339Nano)}
	headers := []string{"X-Internal-Token", strings.Repeat("u", 32), "X-Creator-Metrics-Token", strings.Repeat("c", 32), "X-Creator-Standing-Token", strings.Repeat("s", 32)}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", input, http.StatusNoContent, headers...)
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", input, http.StatusNoContent, headers...)
	eligibility := harness.expect("GET", "/api/v1/creators/eligibility", token, nil, http.StatusOK)
	requirements := eligibility["requirements"].([]any)
	for _, raw := range requirements {
		item := raw.(map[string]any)
		if item["key"] == "policy_standing" && (item["available"] != true || item["currentValue"] != float64(180) || item["met"] != true) {
			t.Fatalf("replayed metrics must not suppress a valid standing snapshot: %+v", item)
		}
	}
	var count int
	if err := harness.module.Container().Database.QueryRowContext(context.Background(), "SELECT count(*) FROM creator_policy_standing_snapshots WHERE profile_id = $1", mustParseUuid(profileId)).Scan(&count); err != nil || count != 1 {
		t.Fatalf("standing replay should be stored once: rows=%d err=%v", count, err)
	}
}

func TestCreatorEligibilityMarksStaleTrustedSnapshotsUnavailable(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("creator.metrics-stale", "Creator Metrics Stale")
	profileId := harness.profileIdOf(token)
	request := map[string]any{"realFollowers": 12_000, "verifiedFollowers": 700, "qualifyingImpressionsLast30Days": 120_000, "originalPostsLast60Days": 12, "creatorMetricsSnapshotId": uuid.NewString(), "creatorMetricsAsOf": time.Now().UTC().Add(-25 * time.Hour).Format(time.RFC3339Nano), "source": "analytics_creator_eligibility_v1"}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", request, http.StatusNoContent, "X-Internal-Token", strings.Repeat("u", 32), "X-Creator-Metrics-Token", strings.Repeat("c", 32))
	eligibility := harness.expect("GET", "/api/v1/creators/eligibility", token, nil, http.StatusOK)
	if eligibility["metricsAvailable"] != false || eligibility["standingAvailable"] != false || eligibility["decision"] != "unavailable" {
		t.Fatalf("stale metrics must not qualify an applicant: %v", eligibility)
	}
	for _, raw := range eligibility["requirements"].([]any) {
		item := raw.(map[string]any)
		switch item["key"] {
		case "qualifying_impressions_30d", "real_followers", "verified_followers", "original_posts":
			if item["available"] != false || item["met"] != false {
				t.Fatalf("stale creator metric should be unavailable: %v", item)
			}
		}
	}
}

func TestCreatorApplicationRequiresTrustedStandingSnapshot(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("creator.standing-missing", "Creator Standing Missing")
	profileId := harness.profileIdOf(token)
	harness.putCreatorMetrics(profileId, 12_000, 700, 120_000)
	eligibility := harness.expect("GET", "/api/v1/creators/eligibility", token, nil, http.StatusOK)
	if eligibility["decision"] != "unavailable" || eligibility["standingAvailable"] != false {
		t.Fatalf("missing trusted standing must not be reported as eligible or rejected: %v", eligibility)
	}
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{
		"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1",
	}, http.StatusServiceUnavailable, "Idempotency-Key", "creator-standing-required-0001")
	count, err := harness.module.Container().Client.CreatorApplication.Query().Where(creatorapplication.AccountID(mustParseUuid(accountId))).Count(context.Background())
	if err != nil || count != 0 {
		t.Fatalf("missing trusted moderation standing must not persist an application: count=%d err=%v", count, err)
	}
}

func TestCreatorEligibilityRoutesRejectMinorAccounts(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, _ := harness.newAccount("creator.minor", "Creator Minor")
	minorToken := harness.tokens.SignAccountAccessTokenWithAgeForTest(t, accountId, "minor")
	harness.expect("GET", "/api/v1/creators/eligibility", minorToken, nil, http.StatusForbidden)
	harness.expect("POST", "/api/v1/creators/applications", minorToken, map[string]any{"contentCategories": []string{"education"}, "acceptedCreatorTermsVersion": "1"}, http.StatusForbidden, "Idempotency-Key", "creator-minor-key-0001")
	unknownAgeToken := harness.tokens.SignAccountAccessTokenWithAgeForTest(t, accountId, "unknown")
	harness.expect("GET", "/api/v1/creators/eligibility", unknownAgeToken, nil, http.StatusForbidden)
	harness.expect("POST", "/api/v1/creators/applications", unknownAgeToken, map[string]any{"contentCategories": []string{"education"}, "acceptedCreatorTermsVersion": "1"}, http.StatusForbidden, "Idempotency-Key", "creator-unknown-age-001")
}

func TestCreatorApplicationNeedsInputAndAdminReviewQueueDecides(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("review.me", "Review Me")
	profileId := harness.profileIdOf(token)
	harness.putCreatorMetrics(profileId, 12_000, 700, 120_000)
	harness.putSignals(profileId, map[string]any{"daysSinceLastViolation": 400, "fraudScore": 55})
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusUnprocessableEntity, "Idempotency-Key", "creator-review-key-0001")
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusCreated, "Idempotency-Key", "creator-review-key-0002")
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusConflict, "Idempotency-Key", "creator-review-key-0003")

	reviewer, reviewerStepUp := harness.staff("admin", "applications:creators")
	denied, _ := harness.staff("admin", "users:read")
	harness.expect("GET", "/api/v1/admin/applications/creators", denied, nil, http.StatusForbidden)
	queue := harness.expect("GET", "/api/v1/admin/applications/creators", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["status"] != "PENDING" || len(queue[0].(map[string]any)["eligibility"].([]any)) != 7 {
		t.Fatalf("the review queue shows the checklist: %v", queue)
	}
	id := queue[0].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/admin/applications/creators/"+id+"/approve", reviewer, map[string]string{"reason": "ok"}, http.StatusBadRequest, reviewerStepUp...)
	approved := harness.expect("POST", "/api/v1/admin/applications/creators/"+id+"/approve", reviewer, map[string]string{"reason": "checked content and followers"}, http.StatusOK, reviewerStepUp...)
	if approved["status"] != "APPROVED" {
		t.Fatalf("unexpected %v", approved)
	}
	harness.expect("POST", "/api/v1/admin/applications/creators/"+id+"/reject", reviewer, map[string]string{"reason": "changed my mind"}, http.StatusConflict, reviewerStepUp...)
	if me := harness.expect("GET", "/api/v1/users/me", token, nil, http.StatusOK); me["isCreator"] != true {
		t.Fatalf("approval turns the personal profile into a creator account: %v", me)
	}
	harness.waitForPublishedEvents("creatorApplication.needsReview", "creatorApplication.approved", "creatorApplication.decided")
}

func TestEligibleCreatorCanApplyWithoutPayoutAccountAndIsHeldForManualReview(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("creator.without.payout", "Creator Without Payout")
	profileId := harness.profileIdOf(token)
	harness.putCreatorMetrics(profileId, 12_000, 700, 120_000)
	harness.putSignals(profileId, map[string]any{"originalPostsLast60Days": 12, "daysSinceLastViolation": 400, "fraudScore": 10})
	application := harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{
		"contentCategories": []string{"education"}, "acceptedCreatorTermsVersion": "1",
	}, http.StatusCreated, "Idempotency-Key", "creator-payout-key-0001")
	if application["status"] != "pending" {
		t.Fatalf("an eligible applicant without a payout account must be held pending: %v", application)
	}
	reviewer, _ := harness.staff("admin", "applications:creators")
	detail := harness.expect("GET", "/api/v1/admin/applications/creators/"+application["id"].(string), reviewer, nil, http.StatusOK)
	if detail["status"] != "PENDING" || detail["decision"] != "manual_review" {
		t.Fatalf("an eligible applicant without a payout account must be manually reviewed: %v", detail)
	}
	if detail["decisionNote"] != "Your application will be reviewed by our team. You can add a payout account later; earnings remain in your creator balance until one is available." {
		t.Fatalf("application should explain the payout requirement is deferred: %v", detail)
	}
}
