package integrations

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"

	"zudomart/modules/ads/src/types"
)

var baselineCtrPpmByFormat = map[string]int64{"feed_post": 12_000, "clip": 20_000, "product": 18_000, "store": 10_000, "story": 15_000, "live": 25_000}

type DeterministicPctrScorer struct{ BaselinePpm int64 }

func (scorer DeterministicPctrScorer) ScorePredictedClickRatesInPpm(_ context.Context, request types.PctrRequest) (map[string]int64, error) {
	scores := make(map[string]int64, len(request.Candidates))
	for _, candidate := range request.Candidates {
		prior := baselineCtrPpmByFormat[candidate.Format]
		if prior == 0 {
			prior = scorer.BaselinePpm
		}
		const priorWeight = 1_000
		scores[candidate.AdId] = (candidate.HistoricalClicks*1_000_000 + prior*priorWeight) / (candidate.HistoricalImpressions + priorWeight)
	}
	return scores, nil
}

type circuitBreaker struct {
	mutex       sync.Mutex
	failures    int
	openedUntil time.Time
}

func (breaker *circuitBreaker) allow(now time.Time) bool {
	breaker.mutex.Lock()
	defer breaker.mutex.Unlock()
	return !now.Before(breaker.openedUntil)
}

func (breaker *circuitBreaker) record(now time.Time, failed bool) {
	breaker.mutex.Lock()
	defer breaker.mutex.Unlock()
	if !failed {
		breaker.failures = 0
		return
	}
	breaker.failures++
	if breaker.failures >= 5 {
		breaker.openedUntil, breaker.failures = now.Add(5*time.Second), 0
	}
}

type IntelligenceClient struct {
	BaseUrl string
	Secret  string
	Timeout time.Duration
	Http    *http.Client
	Now     func() time.Time
	breaker circuitBreaker
}

var ErrIntelligenceUnavailable = errors.New("intelligence service unavailable")

func (client *IntelligenceClient) post(ctx context.Context, path string, body, destination any) error {
	if client.BaseUrl == "" || !client.breaker.allow(client.Now()) {
		return ErrIntelligenceUnavailable
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, client.Timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseUrl+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	signIntelligenceRequest(request, path, raw, client.Secret, client.Now())
	response, err := client.Http.Do(request)
	if err != nil {
		client.breaker.record(client.Now(), true)
		return ErrIntelligenceUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		client.breaker.record(client.Now(), response.StatusCode >= 500)
		return fmt.Errorf("%w: status %d", ErrIntelligenceUnavailable, response.StatusCode)
	}
	client.breaker.record(client.Now(), false)
	return json.NewDecoder(response.Body).Decode(destination)
}

func signIntelligenceRequest(request *http.Request, path string, body []byte, secret string, now time.Time) {
	nonce := make([]byte, 16)
	_, _ = rand.Read(nonce)
	timestamp, nonceText := strconv.FormatInt(now.Unix(), 10), hex.EncodeToString(nonce)
	bodyHash := sha256.Sum256(body)
	canonical := "v1\nPOST\n" + path + "\n" + timestamp + "\n" + nonceText + "\n" + hex.EncodeToString(bodyHash[:])
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(canonical))
	request.Header.Set("content-type", "application/json")
	request.Header.Set("x-zudo-timestamp", timestamp)
	request.Header.Set("x-zudo-nonce", nonceText)
	request.Header.Set("x-zudo-signature", "v1="+hex.EncodeToString(mac.Sum(nil)))
}

type PctrWithFallbackScorer struct {
	Client   *IntelligenceClient
	Fallback DeterministicPctrScorer
}

var (
	mediaTypeByFormat   = map[string]string{"feed_post": "image", "clip": "video", "product": "product_tile", "store": "image", "story": "image", "live": "live_stream"}
	aspectRatioByFormat = map[string]string{"clip": "9:16", "story": "9:16", "live": "9:16"}
	pythonAgeBracket    = regexp.MustCompile(`^(13-17|18-24|25-34|35-44|45-54|55-64|65\+)$`)
)

func (scorer PctrWithFallbackScorer) ScorePredictedClickRatesInPpm(ctx context.Context, request types.PctrRequest) (map[string]int64, error) {
	fallback, _ := scorer.Fallback.ScorePredictedClickRatesInPpm(ctx, request)
	if len(request.Candidates) == 0 || len(request.Candidates) > 300 {
		return fallback, nil
	}
	var response struct {
		Predictions []struct {
			AdId               string  `json:"adId"`
			PredictedClickRate float64 `json:"predictedClickRate"`
		} `json:"predictions"`
	}
	if err := scorer.Client.post(ctx, "/v1/ads/predicted-ctr", predictedCtrPayload(request), &response); err != nil {
		return fallback, nil
	}
	for _, prediction := range response.Predictions {
		if ppm := int64(prediction.PredictedClickRate * 1_000_000); ppm > 0 && ppm < 1_000_000 {
			if _, known := fallback[prediction.AdId]; known {
				fallback[prediction.AdId] = ppm
			}
		}
	}
	return fallback, nil
}

func predictedCtrPayload(request types.PctrRequest) map[string]any {
	viewer := map[string]any{"userId": request.Viewer.UserId}
	if request.Viewer.Country != "" {
		viewer["country"] = request.Viewer.Country
	}
	if pythonAgeBracket.MatchString(request.Viewer.AgeBand) {
		viewer["ageBracket"] = request.Viewer.AgeBand
	}
	candidates := make([]map[string]any, 0, len(request.Candidates))
	for _, candidate := range request.Candidates {
		bidType := "cpm"
		if candidate.BidType == "cpc" {
			bidType = "cpc"
		}
		money := func(minor int64) map[string]any {
			return map[string]any{"amountMinor": max(minor, 0), "currency": candidate.Currency}
		}
		aspect := aspectRatioByFormat[candidate.Format]
		if aspect == "" {
			aspect = "4:5"
		}
		mediaType := mediaTypeByFormat[candidate.Format]
		if mediaType == "" {
			mediaType = "image"
		}
		placements := candidate.Placements
		if len(placements) == 0 {
			placements = []string{request.Placement}
		}
		candidates = append(candidates, map[string]any{
			"adId": candidate.AdId, "campaignId": candidate.CampaignId, "advertiserId": candidate.AccountId, "status": "active", "bidType": bidType,
			"bid": money(candidate.BidMinor), "dailyBudget": money(candidate.DailyBudgetMinor), "spentToday": money(0), "spentTotal": money(0),
			"placements": placements, "creative": map[string]any{"mediaType": mediaType, "aspectRatio": aspect},
			"lifetimeImpressions": candidate.HistoricalImpressions, "lifetimeClicks": candidate.HistoricalClicks,
		})
	}
	return map[string]any{"placement": request.Placement, "viewer": viewer, "candidates": candidates}
}

type IntelligenceFraudScorer struct{ Client *IntelligenceClient }

// ScoreAdEvent scores clicks through /v1/risk/score-extended (subject ad_click); other event kinds are not risk-scored.
func (scorer IntelligenceFraudScorer) ScoreAdEvent(ctx context.Context, impressionId, userId, eventKind string, signals types.AdClickSignals) (*float64, error) {
	if eventKind != "click" {
		return nil, nil
	}
	var response struct {
		Score float64 `json:"score"`
	}
	adClick := map[string]any{"clicksByActorLastHour": max(signals.ClicksByActorLastMinute, 0)}
	if signals.MillisecondsFromImpression >= 0 && signals.MillisecondsFromImpression <= 86_400_000 {
		adClick["millisecondsFromImpressionToClick"] = signals.MillisecondsFromImpression
	}
	payload := map[string]any{"subjectType": "ad_click", "subjectId": impressionId, "actorId": userId, "adClick": adClick}
	if err := scorer.Client.post(ctx, "/v1/risk/score-extended", payload, &response); err != nil {
		return nil, nil
	}
	return &response.Score, nil
}

type NoFraudModel struct{}

func (NoFraudModel) ScoreAdEvent(context.Context, string, string, string, types.AdClickSignals) (*float64, error) {
	return nil, nil
}
