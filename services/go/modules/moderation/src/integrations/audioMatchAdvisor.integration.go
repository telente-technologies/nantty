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
	"time"
)

const copyrightAudioMatchPath = "/v1/audio/copyright-matches"

var ErrAudioMatchUnavailable = errors.New("audio match advice unavailable")

type AudioMatchAdvice struct {
	TargetMediaId         string  `json:"targetMediaId"`
	ConfidencePercent     int     `json:"confidencePercent"`
	TargetStartSeconds    float64 `json:"targetStartSeconds"`
	TargetEndSeconds      float64 `json:"targetEndSeconds"`
	ReferenceStartSeconds float64 `json:"referenceStartSeconds"`
}

type AudioMatchAdviceResult struct {
	Available         bool               `json:"available"`
	FingerprintSource string             `json:"fingerprintSource"`
	Matches           []AudioMatchAdvice `json:"matches"`
}

type AudioMatchAdvisor interface {
	MatchCopyrightAudio(ctx context.Context, claimId, referenceMediaId string, targetMediaIds []string) (AudioMatchAdviceResult, error)
}

type UnconfiguredAudioMatchAdvisor struct{}

func (UnconfiguredAudioMatchAdvisor) MatchCopyrightAudio(context.Context, string, string, []string) (AudioMatchAdviceResult, error) {
	return AudioMatchAdviceResult{}, ErrAudioMatchUnavailable
}

type IntelligenceAudioMatchAdvisor struct {
	BaseUrl string
	Secret  string
	Client  *http.Client
	Now     func() time.Time
}

func NewIntelligenceAudioMatchAdvisor(baseUrl, secret string, timeout time.Duration) AudioMatchAdvisor {
	if baseUrl == "" || secret == "" {
		return UnconfiguredAudioMatchAdvisor{}
	}
	return IntelligenceAudioMatchAdvisor{BaseUrl: baseUrl, Secret: secret, Client: &http.Client{Timeout: timeout}, Now: time.Now}
}

func SignIntelligenceRequest(request *http.Request, path string, body []byte, secret string, now time.Time) {
	nonce := make([]byte, 16)
	_, _ = rand.Read(nonce)
	timestamp, nonceText := strconv.FormatInt(now.Unix(), 10), hex.EncodeToString(nonce)
	bodyHash := sha256.Sum256(body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("v1\n" + request.Method + "\n" + path + "\n" + timestamp + "\n" + nonceText + "\n" + hex.EncodeToString(bodyHash[:])))
	request.Header.Set("content-type", "application/json")
	request.Header.Set("x-nantty-timestamp", timestamp)
	request.Header.Set("x-nantty-nonce", nonceText)
	request.Header.Set("x-nantty-signature", "v1="+hex.EncodeToString(mac.Sum(nil)))
}

func (advisor IntelligenceAudioMatchAdvisor) MatchCopyrightAudio(ctx context.Context, claimId, referenceMediaId string, targetMediaIds []string) (AudioMatchAdviceResult, error) {
	body, err := json.Marshal(map[string]any{"claimId": claimId, "referenceMediaId": referenceMediaId, "targetMediaIds": targetMediaIds})
	if err != nil {
		return AudioMatchAdviceResult{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, advisor.BaseUrl+copyrightAudioMatchPath, bytes.NewReader(body))
	if err != nil {
		return AudioMatchAdviceResult{}, err
	}
	SignIntelligenceRequest(request, copyrightAudioMatchPath, body, advisor.Secret, advisor.Now())
	response, err := advisor.Client.Do(request)
	if err != nil {
		return AudioMatchAdviceResult{}, fmt.Errorf("%w: %v", ErrAudioMatchUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return AudioMatchAdviceResult{}, fmt.Errorf("%w: intelligence answered %d", ErrAudioMatchUnavailable, response.StatusCode)
	}
	var result AudioMatchAdviceResult
	return result, json.NewDecoder(response.Body).Decode(&result)
}
