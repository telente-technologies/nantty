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

func (scorer PctrWithFallbackScorer) ScorePredictedClickRatesInPpm(ctx context.Context, request types.PctrRequest) (map[string]int64, error) {
	fallback, _ := scorer.Fallback.ScorePredictedClickRatesInPpm(ctx, request)
	var response struct {
		Scores []struct {
			AdId string  `json:"adId"`
			Pctr float64 `json:"pctr"`
		} `json:"scores"`
	}
	payload := map[string]any{"placement": request.Placement, "slotKind": request.SlotKind, "viewer": map[string]any{"userId": request.Viewer.UserId, "country": request.Viewer.Country, "ageBracket": request.Viewer.AgeBand}, "candidates": request.Candidates}
	if err := scorer.Client.post(ctx, "/v1/ads/pctr", payload, &response); err != nil {
		return fallback, nil
	}
	for _, score := range response.Scores {
		if ppm := int64(score.Pctr * 1_000_000); ppm > 0 && ppm < 1_000_000 {
			if _, known := fallback[score.AdId]; known {
				fallback[score.AdId] = ppm
			}
		}
	}
	return fallback, nil
}

type IntelligenceFraudScorer struct{ Client *IntelligenceClient }

func (scorer IntelligenceFraudScorer) ScoreAdEvent(ctx context.Context, impressionId, userId, eventKind string) (*float64, error) {
	var response struct {
		Score float64 `json:"score"`
	}
	payload := map[string]any{"subjectType": "ad_event", "subjectId": impressionId, "actorId": userId, "adEvent": map[string]any{"eventKind": eventKind}}
	if err := scorer.Client.post(ctx, "/v1/risk/score", payload, &response); err != nil {
		return nil, nil
	}
	return &response.Score, nil
}

type NoFraudModel struct{}

func (NoFraudModel) ScoreAdEvent(context.Context, string, string, string) (*float64, error) {
	return nil, nil
}
