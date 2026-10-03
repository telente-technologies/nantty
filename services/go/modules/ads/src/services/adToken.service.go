package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var (
	ErrAdTokenMalformed    = errors.New("ad token is malformed")
	ErrAdTokenSignature    = errors.New("ad token signature is invalid")
	ErrAdTokenExpired      = errors.New("ad token has expired")
	ErrAdTokenUserMismatch = errors.New("ad token belongs to another viewer")
)

const adTokenVersion = "v1"

type AdTokenClaims struct {
	ImpressionId      string `json:"i"`
	AdId              string `json:"a"`
	AdGroupId         string `json:"g"`
	CampaignId        string `json:"c"`
	AccountId         string `json:"ac"`
	UserId            string `json:"u"`
	SessionId         string `json:"s"`
	Placement         string `json:"p"`
	SlotKind          string `json:"k"`
	ContentId         string `json:"ci,omitempty"`
	CreatorUserId     string `json:"cu,omitempty"`
	Country           string `json:"co,omitempty"`
	Region            string `json:"rg,omitempty"`
	AgeBand           string `json:"ab,omitempty"`
	Gender            string `json:"gn,omitempty"`
	AiGenerated       bool   `json:"ai,omitempty"`
	Currency          string `json:"cy"`
	Timezone          string `json:"tz,omitempty"`
	Basis             string `json:"b"`
	PriceMicros       int64  `json:"pm"`
	PctrPpm           int64  `json:"pc"`
	CreatorShareBps   int64  `json:"cs"`
	MultiplierBps     int64  `json:"mb"`
	QualifyWatchMs    int    `json:"qw"`
	QualifyVisiblePct int    `json:"qv"`
	NewReachToday     bool   `json:"nr,omitempty"`
	IssuedAtUnix      int64  `json:"iat"`
	ExpiresAtUnix     int64  `json:"exp"`
}

type AdTokenSigner struct {
	ActiveKeyId string
	Keys        map[string][]byte
	TimeToLive  time.Duration
	Now         func() time.Time
}

func (signer AdTokenSigner) Sign(claims AdTokenClaims) (string, error) {
	key, found := signer.Keys[signer.ActiveKeyId]
	if !found {
		return "", errors.New("active ad token key is not configured")
	}
	now := signer.Now()
	claims.IssuedAtUnix = now.Unix()
	claims.ExpiresAtUnix = now.Add(signer.TimeToLive).Unix()
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	head := adTokenVersion + "." + signer.ActiveKeyId + "." + encoded
	return head + "." + base64.RawURLEncoding.EncodeToString(computeAdTokenSignature(key, head)), nil
}

func (signer AdTokenSigner) Verify(token, expectedUserId string) (AdTokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 4 || parts[0] != adTokenVersion {
		return AdTokenClaims{}, ErrAdTokenMalformed
	}
	key, found := signer.Keys[parts[1]]
	if !found {
		return AdTokenClaims{}, ErrAdTokenSignature
	}
	supplied, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return AdTokenClaims{}, ErrAdTokenMalformed
	}
	if !hmac.Equal(supplied, computeAdTokenSignature(key, strings.Join(parts[:3], "."))) {
		return AdTokenClaims{}, ErrAdTokenSignature
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return AdTokenClaims{}, ErrAdTokenMalformed
	}
	var claims AdTokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return AdTokenClaims{}, ErrAdTokenMalformed
	}
	if signer.Now().Unix() >= claims.ExpiresAtUnix {
		return AdTokenClaims{}, ErrAdTokenExpired
	}
	if claims.UserId != expectedUserId {
		return AdTokenClaims{}, ErrAdTokenUserMismatch
	}
	return claims, nil
}

func computeAdTokenSignature(key []byte, head string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(head))
	return mac.Sum(nil)
}
