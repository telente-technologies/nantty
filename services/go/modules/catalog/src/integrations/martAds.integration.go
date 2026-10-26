package integrations

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"nantty/modules/catalog/src/interfaces"
)

const martAdDecidePath = "/internal/v1/ads/decide"

type HttpMartAds struct {
	BaseUrl string
	Secret  string
	Http    *http.Client
	Now     func() time.Time
}

func NewHttpMartAds(baseUrl, secret string) *HttpMartAds {
	return &HttpMartAds{BaseUrl: baseUrl, Secret: secret, Http: &http.Client{Timeout: 800 * time.Millisecond}, Now: time.Now}
}

type martDecideRequest struct {
	UserId    string            `json:"userId"`
	SessionId string            `json:"sessionId"`
	Slot      map[string]string `json:"slot"`
	Viewer    map[string]string `json:"viewer"`
}

type martDecidedCreative struct {
	Type         string `json:"type"`
	Headline     string `json:"headline"`
	PrimaryText  string `json:"primaryText"`
	CallToAction string `json:"callToAction"`
	Source       struct {
		Type string `json:"type"`
		Id   string `json:"id"`
	} `json:"source"`
	Destination struct {
		Type     string  `json:"type"`
		TargetId *string `json:"targetId"`
	} `json:"destination"`
	Identity struct {
		Name string `json:"name"`
	} `json:"identity"`
	Media []struct {
		Url string `json:"url"`
	} `json:"media"`
}

type martDecideResponse struct {
	Ad *struct {
		AdId            string                       `json:"adId"`
		ImpressionToken string                       `json:"impressionToken"`
		Label           string                       `json:"label"`
		Creative        martDecidedCreative          `json:"creative"`
		ClickLinks      *interfaces.MartAdClickLinks `json:"clickLinks"`
	} `json:"ad"`
}

func (client *HttpMartAds) DecideMartTile(ctx context.Context, martRequest interfaces.MartAdRequest) (*interfaces.MartAd, error) {
	if client == nil || client.BaseUrl == "" || client.Secret == "" {
		return nil, nil
	}
	raw, err := json.Marshal(martDecideRequest{
		UserId: martRequest.Viewer.String(), SessionId: "mart-" + martRequest.Viewer.String(),
		Slot: map[string]string{"kind": "martTile"}, Viewer: map[string]string{"country": martRequest.Country},
	})
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseUrl+martAdDecidePath, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if err := signAdsRequest(request, raw, client.Secret, client.Now()); err != nil {
		return nil, err
	}
	response, err := client.Http.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ads decide answered %d", response.StatusCode)
	}
	var decided martDecideResponse
	if err := json.NewDecoder(response.Body).Decode(&decided); err != nil {
		return nil, err
	}
	if decided.Ad == nil {
		return nil, nil
	}
	creative := decided.Ad.Creative
	ad := &interfaces.MartAd{
		AdId: decided.Ad.AdId, ImpressionToken: decided.Ad.ImpressionToken, Label: decided.Ad.Label, AdvertiserName: creative.Identity.Name,
		Headline: creative.Headline, PrimaryText: creative.PrimaryText, CallToAction: creative.CallToAction, AdType: creative.Type, ClickLinks: decided.Ad.ClickLinks,
	}
	if creative.Source.Type == "product" {
		ad.ProductId = creative.Source.Id
	} else if creative.Destination.Type == "product" && creative.Destination.TargetId != nil {
		ad.ProductId = *creative.Destination.TargetId
	}
	if len(creative.Media) > 0 {
		ad.ImageUrl = creative.Media[0].Url
	}
	return ad, nil
}

func signAdsRequest(request *http.Request, body []byte, secret string, now time.Time) error {
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return err
	}
	timestamp, nonce := strconv.FormatInt(now.Unix(), 10), hex.EncodeToString(nonceBytes)
	bodyHash := sha256.Sum256(body)
	canonical := "v1\n" + request.Method + "\n" + request.URL.RequestURI() + "\n" + timestamp + "\n" + nonce + "\n" + hex.EncodeToString(bodyHash[:])
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(canonical))
	request.Header.Set("x-zudo-timestamp", timestamp)
	request.Header.Set("x-zudo-nonce", nonce)
	request.Header.Set("x-zudo-signature", "v1="+hex.EncodeToString(mac.Sum(nil)))
	return nil
}
