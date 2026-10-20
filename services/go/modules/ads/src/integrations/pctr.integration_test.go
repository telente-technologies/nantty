package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"zudomart/modules/ads/src/types"
)

func request() types.PctrRequest {
	return types.PctrRequest{
		Viewer: types.Viewer{UserId: "viewer-1", Country: "NG", AgeBand: "25-34", PersonalizedAds: true}, Placement: "feed", SlotKind: "feedPost",
		Candidates: []types.PctrCandidate{{AdId: "ad-1", CampaignId: "c-1", AccountId: "a-1", Format: "clip", BidType: "cpc", BidMinor: 500, DailyBudgetMinor: 100_000, Currency: "NGN", Placements: []string{"clips"}, HistoricalImpressions: 2000, HistoricalClicks: 100}},
	}
}

func clientFor(server *httptest.Server) *IntelligenceClient {
	return &IntelligenceClient{BaseUrl: server.URL, Secret: "s", Timeout: time.Second, Http: server.Client(), Now: time.Now}
}

func TestPredictedCtrCallsTheDocumentedEndpointAndUsesItsPredictions(t *testing.T) {
	var path string
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, received *http.Request) {
		path = received.URL.Path
		_ = json.NewDecoder(received.Body).Decode(&body)
		_, _ = writer.Write([]byte(`{"predictions":[{"adId":"ad-1","predictedClickRate":0.042}],"personalized":true,"metadata":{}}`))
	}))
	defer server.Close()
	scorer := PctrWithFallbackScorer{Client: clientFor(server), Fallback: DeterministicPctrScorer{BaselinePpm: 15_000}}
	scores, err := scorer.ScorePredictedClickRatesInPpm(context.Background(), request())
	if err != nil || scores["ad-1"] != 42_000 || path != "/v1/ads/predicted-ctr" {
		t.Fatalf("got %v %v on %s", scores, err, path)
	}
	candidate := body["candidates"].([]any)[0].(map[string]any)
	if candidate["bidType"] != "cpc" || candidate["advertiserId"] != "a-1" || candidate["creative"].(map[string]any)["mediaType"] != "video" || candidate["creative"].(map[string]any)["aspectRatio"] != "9:16" {
		t.Fatalf("unexpected candidate payload %v", candidate)
	}
	if body["viewer"].(map[string]any)["ageBracket"] != "25-34" {
		t.Fatalf("unexpected viewer %v", body["viewer"])
	}
}

func TestPredictedCtrFallsBackToTheDeterministicScoreWhenIntelligenceFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusInternalServerError) }))
	defer server.Close()
	scorer := PctrWithFallbackScorer{Client: clientFor(server), Fallback: DeterministicPctrScorer{BaselinePpm: 15_000}}
	scores, err := scorer.ScorePredictedClickRatesInPpm(context.Background(), request())
	if err != nil || scores["ad-1"] <= 0 || scores["ad-1"] == 42_000 {
		t.Fatalf("expected the deterministic fallback, got %v %v", scores, err)
	}
}

func TestPredictedCtrFallsBackWhenTheTimeoutIsExceeded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		time.Sleep(200 * time.Millisecond)
		_, _ = writer.Write([]byte(`{"predictions":[{"adId":"ad-1","predictedClickRate":0.5}]}`))
	}))
	defer server.Close()
	client := clientFor(server)
	client.Timeout = 20 * time.Millisecond
	scores, _ := (PctrWithFallbackScorer{Client: client, Fallback: DeterministicPctrScorer{BaselinePpm: 15_000}}).ScorePredictedClickRatesInPpm(context.Background(), request())
	if scores["ad-1"] == 500_000 {
		t.Fatal("a slow response must not be used")
	}
}

func TestClicksAreRiskScoredAsAdClickSubjectsAndOtherEventsAreSkipped(t *testing.T) {
	var path string
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, received *http.Request) {
		path = received.URL.Path
		_ = json.NewDecoder(received.Body).Decode(&body)
		_, _ = writer.Write([]byte(`{"score":0.91}`))
	}))
	defer server.Close()
	scorer := IntelligenceFraudScorer{Client: clientFor(server)}
	if score, _ := scorer.ScoreAdEvent(context.Background(), "imp-1", "viewer-1", "complete", types.AdClickSignals{}); score != nil || path != "" {
		t.Fatal("only clicks are risk-scored")
	}
	score, _ := scorer.ScoreAdEvent(context.Background(), "imp-1", "viewer-1", "click", types.AdClickSignals{ClicksByActorLastMinute: 3, MillisecondsFromImpression: 450})
	if score == nil || *score != 0.91 || path != "/v1/risk/score-extended" || body["subjectType"] != "ad_click" {
		t.Fatalf("got %v on %s: %v", score, path, body)
	}
	if body["adClick"].(map[string]any)["millisecondsFromImpressionToClick"] != float64(450) {
		t.Fatalf("unexpected adClick %v", body["adClick"])
	}
}
