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

	"github.com/google/uuid"

	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/services"
)

const (
	productRecommendationsPath          = "/v1/recommendations/products"
	productRecommendationCandidatesPath = "/v1/recommendations/products/candidates"
)

var ErrProductRecommendationsUnavailable = errors.New("product recommendations unavailable")

type HttpProductRecommender struct {
	BaseUrl      string
	Secret       string
	IdHashSecret string
	Http         *http.Client
	Now          func() time.Time
}

func NewHttpProductRecommender(baseUrl, secret, idHashSecret string) *HttpProductRecommender {
	return &HttpProductRecommender{
		BaseUrl: baseUrl, Secret: secret, IdHashSecret: idHashSecret,
		Http: &http.Client{Timeout: 120 * time.Millisecond}, Now: time.Now,
	}
}

type pythonProductCandidate struct {
	ProductId     string         `json:"productId"`
	StoreId       string         `json:"storeId"`
	CategoryId    *string        `json:"categoryId,omitempty"`
	Topics        []string       `json:"topics,omitempty"`
	Price         map[string]any `json:"price,omitempty"`
	Rating        float64        `json:"rating,omitempty"`
	SalesCount    int            `json:"salesCount"`
	Country       string         `json:"country,omitempty"`
	StoreVerified bool           `json:"storeVerified"`
	InStock       bool           `json:"inStock"`
}

type pythonProductRecommendationRequest struct {
	Surface                string                   `json:"surface"`
	Viewer                 map[string]any           `json:"viewer"`
	PersonalizationAllowed bool                     `json:"personalizationAllowed"`
	Candidates             []pythonProductCandidate `json:"candidates"`
	ExcludedProductIds     []string                 `json:"excludedProductIds"`
	Limit                  int                      `json:"limit"`
}

type pythonProductRecommendationResponse struct {
	Items []struct {
		ItemId string `json:"itemId"`
	} `json:"items"`
}

type pythonProductCandidateRecallRequest struct {
	Viewer                 map[string]any `json:"viewer"`
	PersonalizationAllowed bool           `json:"personalizationAllowed"`
	Limit                  int            `json:"limit"`
}

type pythonProductCandidateRecallResponse struct {
	ItemIds []string `json:"itemIds"`
}

func (client *HttpProductRecommender) RecallProductIds(
	ctx context.Context,
	viewerId uuid.UUID,
	personalizationAllowed bool,
	limit int,
) ([]string, error) {
	if !personalizationAllowed || viewerId == uuid.Nil {
		return []string{}, nil
	}
	if client == nil || client.BaseUrl == "" || client.Secret == "" || limit < 1 || limit > 100 {
		return nil, ErrProductRecommendationsUnavailable
	}
	viewerKey := hashViewerKey(viewerId, client.IdHashSecret, client.Secret)
	raw, err := json.Marshal(pythonProductCandidateRecallRequest{
		Viewer: map[string]any{"userId": viewerKey}, PersonalizationAllowed: true, Limit: limit,
	})
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseUrl+productRecommendationCandidatesPath, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if err := signIntelligenceProductRequest(request, productRecommendationCandidatesPath, raw, client.Secret, client.Now()); err != nil {
		return nil, err
	}
	response, err := client.Http.Do(request)
	if err != nil {
		return nil, ErrProductRecommendationsUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrProductRecommendationsUnavailable, response.StatusCode)
	}
	var result pythonProductCandidateRecallResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.ItemIds, nil
}

func (client *HttpProductRecommender) RankProducts(
	ctx context.Context,
	viewerId uuid.UUID,
	personalizationAllowed bool,
	country string,
	candidates []interfaces.ProductRankingCandidate,
) ([]string, error) {
	if client == nil || client.BaseUrl == "" || client.Secret == "" || len(candidates) == 0 || len(candidates) > 500 {
		return nil, ErrProductRecommendationsUnavailable
	}
	viewerKey := hashViewerKey(viewerId, client.IdHashSecret, client.Secret)
	if !personalizationAllowed || viewerId == uuid.Nil {
		viewerKey = "contextual-viewer"
	}
	viewer := map[string]any{"userId": viewerKey}
	if country != "" {
		viewer["country"] = country
	}
	requestCandidates := make([]pythonProductCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		item := pythonProductCandidate{
			ProductId: candidate.ProductId, StoreId: candidate.StoreId, Topics: candidate.Topics,
			SalesCount: candidate.SalesCount, Country: candidate.Country, StoreVerified: candidate.StoreVerified, InStock: candidate.InStock,
		}
		if candidate.CategoryId != "" {
			item.CategoryId = &candidate.CategoryId
		}
		if candidate.Currency != "" && candidate.PriceMinor >= 0 {
			item.Price = map[string]any{"amountMinor": candidate.PriceMinor, "currency": candidate.Currency}
		}
		if candidate.Rating > 0 {
			item.Rating = candidate.Rating
		}
		requestCandidates = append(requestCandidates, item)
	}
	raw, err := json.Marshal(pythonProductRecommendationRequest{
		Surface: "for_you", Viewer: viewer, PersonalizationAllowed: personalizationAllowed,
		Candidates: requestCandidates, ExcludedProductIds: []string{}, Limit: 20,
	})
	if err != nil {
		return nil, err
	}
	path := productRecommendationsPath
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseUrl+path, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if err := signIntelligenceProductRequest(request, path, raw, client.Secret, client.Now()); err != nil {
		return nil, err
	}
	response, err := client.Http.Do(request)
	if err != nil {
		return nil, ErrProductRecommendationsUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrProductRecommendationsUnavailable, response.StatusCode)
	}
	var result pythonProductRecommendationResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(result.Items))
	for _, item := range result.Items {
		if item.ItemId != "" {
			ids = append(ids, item.ItemId)
		}
	}
	return ids, nil
}

func hashViewerKey(viewerId uuid.UUID, idHashSecret, sharedSecret string) string {
	if viewerId == uuid.Nil {
		return "contextual-viewer"
	}
	return services.HashIntelligenceUserId(viewerId.String(), idHashSecret, sharedSecret)
}

func signIntelligenceProductRequest(request *http.Request, path string, body []byte, secret string, now time.Time) error {
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return err
	}
	timestamp, nonce := strconv.FormatInt(now.Unix(), 10), hex.EncodeToString(nonceBytes)
	bodyHash := sha256.Sum256(body)
	canonical := "v1\nPOST\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + hex.EncodeToString(bodyHash[:])
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(canonical))
	request.Header.Set("content-type", "application/json")
	request.Header.Set("x-nantty-timestamp", timestamp)
	request.Header.Set("x-nantty-nonce", nonce)
	request.Header.Set("x-nantty-signature", "v1="+hex.EncodeToString(mac.Sum(nil)))
	return nil
}
