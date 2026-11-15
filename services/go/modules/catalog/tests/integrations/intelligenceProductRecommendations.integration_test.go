package integrations_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/integrations"
	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/services"
)

func TestHttpProductRecommenderSignsRequestAndPseudonymizesViewer(t *testing.T) {
	viewerId := uuid.MustParse("0192f0a0-0000-7000-8000-0000000000bb")
	now := time.Unix(1_800_000_000, 0)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/recommendations/products" {
			t.Errorf("unexpected path: %s", request.URL.Path)
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		if !validIntelligenceProductSignature(request, body, "shared-key") {
			t.Error("request signature did not match body")
		}
		var payload struct {
			Surface                string           `json:"surface"`
			Viewer                 map[string]any   `json:"viewer"`
			PersonalizationAllowed bool             `json:"personalizationAllowed"`
			Candidates             []map[string]any `json:"candidates"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Viewer["userId"] != "u_345e9e93e0908cbeed547fdd65a486f1fafe6869" {
			t.Errorf("viewer id was not pseudonymized consistently: %v", payload.Viewer["userId"])
		}
		if payload.Surface != "for_you" || payload.Viewer["country"] != "NG" || payload.Candidates[0]["storeVerified"] != true || !payload.PersonalizationAllowed {
			t.Errorf("expected country and authoritative verified-store signal in request: %+v", payload)
		}
		writer.Header().Set("content-type", "application/json")
		_, _ = io.WriteString(writer, `{"items":[{"itemId":"product_1","score":0.8,"reason":"verified_store"}],"metadata":{"requestId":"r1","rankingSource":"products:for_you:rules","degraded":false,"generatedAt":"2026-11-07T00:00:00Z"}}`)
	}))
	defer server.Close()

	client := integrations.NewHttpProductRecommender(server.URL, "shared-key", "id-key")
	client.Now = func() time.Time { return now }
	client.Http = server.Client()
	ids, err := client.RankProducts(context.Background(), viewerId, true, "NG", "for_you", []interfaces.ProductRankingCandidate{{
		ProductId: "product_1", StoreId: "store_1", Currency: "NGN", PriceMinor: 500_000, StoreVerified: true, InStock: true,
	}})
	if err != nil {
		t.Fatalf("RankProducts returned error: %v", err)
	}
	if len(ids) != 1 || ids[0] != "product_1" {
		t.Fatalf("unexpected ids: %v", ids)
	}
}

func TestHttpProductRecommenderUsesContextualViewerWhenPersonalizationIsOff(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		var payload struct {
			Surface                string         `json:"surface"`
			Viewer                 map[string]any `json:"viewer"`
			PersonalizationAllowed bool           `json:"personalizationAllowed"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Surface != "mart_home" || payload.Viewer["userId"] != "contextual-viewer" || payload.PersonalizationAllowed {
			t.Errorf("unexpected personalized viewer id: %v", payload.Viewer["userId"])
		}
		_, _ = io.WriteString(writer, `{"items":[],"metadata":{"requestId":"r1","rankingSource":"products:for_you:rules","degraded":false,"generatedAt":"2026-11-07T00:00:00Z"}}`)
	}))
	defer server.Close()
	client := integrations.NewHttpProductRecommender(server.URL, "shared-key", "id-key")
	client.Http = server.Client()
	if _, err := client.RankProducts(context.Background(), uuid.New(), false, "NG", "mart_home", []interfaces.ProductRankingCandidate{{ProductId: "p", StoreId: "s", InStock: true}}); err != nil {
		t.Fatalf("RankProducts returned error: %v", err)
	}
}

func TestHttpProductRecommenderRecallsOnlyForConsentedViewer(t *testing.T) {
	viewerId := uuid.MustParse("0192f0a0-0000-7000-8000-0000000000bb")
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests++
		if request.URL.Path != "/v1/recommendations/products/candidates" {
			t.Errorf("unexpected candidate recall path: %s", request.URL.Path)
		}
		body, _ := io.ReadAll(request.Body)
		if !validIntelligenceProductSignature(request, body, "shared-key") {
			t.Error("candidate recall request signature did not match body")
		}
		var payload struct {
			Viewer                 map[string]any `json:"viewer"`
			PersonalizationAllowed bool           `json:"personalizationAllowed"`
			Limit                  int            `json:"limit"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatal(err)
		}
		if !payload.PersonalizationAllowed || payload.Limit != 50 || payload.Viewer["userId"] != services.HashIntelligenceUserId(viewerId.String(), "id-key", "shared-key") {
			t.Errorf("unexpected recall request: %+v", payload)
		}
		writer.Header().Set("content-type", "application/json")
		_, _ = io.WriteString(writer, `{"itemIds":["product_1","product_2"]}`)
	}))
	defer server.Close()

	client := integrations.NewHttpProductRecommender(server.URL, "shared-key", "id-key")
	client.Http = server.Client()
	ids, err := client.RecallProductIds(context.Background(), viewerId, true, 50)
	if err != nil || len(ids) != 2 || ids[0] != "product_1" {
		t.Fatalf("unexpected recall result ids=%v err=%v", ids, err)
	}
	ids, err = client.RecallProductIds(context.Background(), viewerId, false, 50)
	if err != nil || len(ids) != 0 || requests != 1 {
		t.Fatalf("non-consenting recall must not call Python: ids=%v requests=%d err=%v", ids, requests, err)
	}
}

func validIntelligenceProductSignature(request *http.Request, body []byte, secret string) bool {
	timestamp, nonce := request.Header.Get("x-nantty-timestamp"), request.Header.Get("x-nantty-nonce")
	provided := request.Header.Get("x-nantty-signature")
	parsed, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || parsed == 0 || nonce == "" {
		return false
	}
	bodyHash := sha256.Sum256(body)
	canonical := "v1\nPOST\n" + request.URL.RequestURI() + "\n" + timestamp + "\n" + nonce + "\n" + hex.EncodeToString(bodyHash[:])
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(canonical))
	return hmac.Equal([]byte(provided), []byte("v1="+hex.EncodeToString(mac.Sum(nil))))
}
