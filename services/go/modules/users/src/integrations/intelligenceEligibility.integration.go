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

const verificationEligibilityPath = "/v1/verification/eligibility"

var ErrIntelligenceUnavailable = errors.New("intelligence service unavailable")

type EligibilityThresholds struct {
	MinimumAccountAgeDays     int `json:"minimumAccountAgeDays"`
	MinimumRealFollowers      int `json:"minimumRealFollowers"`
	NoViolationsInDays        int `json:"noViolationsInDays"`
	MinimumCompletedOrders    int `json:"minimumCompletedOrders"`
	MinimumSuccessRatePercent int `json:"minimumSuccessRatePercent"`
}

type EligibilitySignals struct {
	ProfileId                 string                `json:"profileId"`
	Color                     string                `json:"color"`
	AccountAgeDays            int                   `json:"accountAgeDays"`
	RealFollowers             int                   `json:"realFollowers"`
	OriginalPostsLast60Days   int                   `json:"originalPostsLast60Days"`
	DaysSinceLastViolation    int                   `json:"daysSinceLastViolation"`
	FraudScore                int                   `json:"fraudScore"`
	RiskScore                 int                   `json:"riskScore"`
	BorderlineContent         bool                  `json:"borderlineContent"`
	PhoneVerified             bool                  `json:"phoneVerified"`
	EmailVerified             bool                  `json:"emailVerified"`
	AccountRestricted         bool                  `json:"accountRestricted"`
	CompletedOrders           int                   `json:"completedOrders"`
	SuccessRatePercent        int                   `json:"successRatePercent"`
	HasActiveStoreOrBrandPage bool                  `json:"hasActiveStoreOrBrandPage"`
	Thresholds                EligibilityThresholds `json:"thresholds"`
}

type EligibilityAssessment struct {
	TrustScore        int      `json:"trustScore"`
	Tier              string   `json:"tier"`
	Reasons           []string `json:"reasons"`
	RecheckAfterHours int      `json:"recheckAfterHours"`
	Source            string   `json:"-"`
}

type IntelligenceEligibilityClient struct {
	BaseUrl string
	Secret  string
	Http    *http.Client
	Now     func() time.Time
}

func (client *IntelligenceEligibilityClient) AssessVerificationEligibility(ctx context.Context, signals EligibilitySignals) (EligibilityAssessment, error) {
	if client == nil || client.BaseUrl == "" || client.Secret == "" {
		return EligibilityAssessment{}, ErrIntelligenceUnavailable
	}
	raw, err := json.Marshal(signals)
	if err != nil {
		return EligibilityAssessment{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseUrl+verificationEligibilityPath, bytes.NewReader(raw))
	if err != nil {
		return EligibilityAssessment{}, err
	}
	signIntelligenceRequest(request, verificationEligibilityPath, raw, client.Secret, client.Now())
	response, err := client.Http.Do(request)
	if err != nil {
		return EligibilityAssessment{}, fmt.Errorf("%w: %v", ErrIntelligenceUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return EligibilityAssessment{}, fmt.Errorf("%w: status %d", ErrIntelligenceUnavailable, response.StatusCode)
	}
	var assessment EligibilityAssessment
	if err := json.NewDecoder(response.Body).Decode(&assessment); err != nil {
		return EligibilityAssessment{}, err
	}
	assessment.Source = "intelligence"
	return assessment, nil
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
