package logistics_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/logistics"
	"nantty/modules/orders/src/logistics/kwikpik"
)

func TestKwikpikV2QuoteBookCancelTrackAndLocations(t *testing.T) {
	var methods []string
	var paths []string
	var apiKeys []string
	var bookBody string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		methods = append(methods, r.Method)
		paths = append(paths, r.URL.Path)
		apiKeys = append(apiKeys, r.Header.Get("x-api-key"))
		raw, _ := io.ReadAll(r.Body)

		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/orders/estimate":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"packages": []map[string]any{{
					"deliveryAddress":   "45 Broad St, Lagos, NG",
					"packageSize":       "SMALL",
					"packageWeightInKg": 1.2,
					"estimatedPrice":    3500,
					"insurancePremium":  0,
					"isInsured":         false,
					"currency":          "NGN",
				}},
				"totalEstimatedPrice":   3500,
				"totalInsurancePremium": 0,
				"currency":              "NGN",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/orders/bulk/unified":
			bookBody = string(raw)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"totalCreated": 1,
				"totalFailed":  0,
				"successful": []map[string]any{{
					"id":                  "kp-ord-1",
					"orderRef":            "ord-ref-1",
					"orderCode":           "KWK-ORD-5D21B8",
					"totalEstimatedPrice": 3500,
					"currency":            "NGN",
					"packageInformation": map[string]any{
						"trackingId":            "KWI1234567890",
						"merchantPackageNumber": "ord-ref-1",
						"status":                "PENDING",
					},
				}},
				"failed": []any{},
			})
		case r.Method == http.MethodPatch && r.URL.Path == "/orders/KWK-ORD-5D21B8/cancel":
			_ = json.NewEncoder(w).Encode(map[string]any{"orderCode": "KWK-ORD-5D21B8", "isCancelled": true})
		case r.Method == http.MethodGet && r.URL.Path == "/packages/KWI1234567890/track":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"orderId":        "kp-ord-1",
				"trackingId":     "KWI1234567890",
				"orderCode":      "KWK-ORD-5D21B8",
				"status":         "OUT_FOR_DELIVERY",
				"estimatedPrice": "3500.00",
				"statusHistory": []map[string]any{{
					"status":      "OUT_FOR_DELIVERY",
					"statusCode":  "ARRIVED_AT_DESTINATION",
					"description": "Package arrived at customers address",
					"createdAt":   "2026-11-16T10:00:00Z",
				}},
			})
		case r.Method == http.MethodGet && r.URL.Path == "/locations":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"locations": []map[string]any{{
					"id": "loc-1", "name": "Yaba Hub", "code": "LOS-YB", "city": "Lagos", "state": "Lagos", "country": "Nigeria",
				}},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := kwikpik.NewProvider(kwikpik.Config{
		BaseUrl:          server.URL,
		ApiKey:           "pk_test_kwikpik_v2",
		WebhookSecret:    "kp-webhook-secret",
		ContactEmail:     "logistics@nantty.com",
		AllowInsecureDev: true,
	})
	if err != nil {
		t.Fatalf("new provider: %v", err)
	}

	quotes, err := provider.Quote(context.Background(), logistics.QuoteRequest{
		StoreId:     uuid.New(),
		Pickup:      logistics.Address{RecipientName: "Store", Phone: "+2348000000001", Line1: "12 Allen Ave", City: "Lagos", CountryCode: "NG"},
		Destination: logistics.Address{RecipientName: "Buyer", Phone: "+2348000000002", Line1: "45 Broad St", City: "Lagos", CountryCode: "NG"},
		Parcel:      logistics.Parcel{WeightGrams: 1200, PackageCount: 1, DeclaredValueMinor: 1500000, Currency: "NGN"},
		Currency:    "NGN",
		VehicleType: "MOTORCYCLE",
	})
	if err != nil || len(quotes) != 1 || quotes[0].AmountMinor != 350000 || quotes[0].Currency != "NGN" {
		t.Fatalf("unexpected quotes: %+v err=%v", quotes, err)
	}

	booking, err := provider.Book(context.Background(), logistics.BookRequest{
		StoreId:      uuid.New(),
		OrderGroupId: uuid.New(),
		Reference:    "ord-ref-1",
		Quote:        quotes[0],
		Pickup:       logistics.Address{RecipientName: "Store", Phone: "+2348000000001", Line1: "12 Allen Ave", City: "Lagos", CountryCode: "NG"},
		Destination:  logistics.Address{RecipientName: "Buyer", Phone: "+2348000000002", Line1: "45 Broad St", City: "Lagos", CountryCode: "NG"},
		Parcel:       logistics.Parcel{WeightGrams: 1200, PackageCount: 1, ContentsDescription: strings.Repeat("x", 70), DeclaredValueMinor: 1500000, Currency: "NGN"},
	})
	if err != nil || booking.ProviderReference != "KWK-ORD-5D21B8" || booking.TrackingNumber != "KWI1234567890" || booking.Status != logistics.StatusBooked {
		t.Fatalf("unexpected booking: %+v err=%v", booking, err)
	}
	if !strings.Contains(bookBody, `"pickupContactEmail":"logistics@nantty.com"`) || strings.Contains(bookBody, `"deliveryContactEmail"`) {
		t.Fatalf("unexpected contact email handling in book payload: %s", bookBody)
	}
	if !strings.Contains(bookBody, fmt.Sprintf(`"description":"%s"`, strings.Repeat("x", 50))) {
		t.Fatalf("expected 50-char truncated description, got %s", bookBody)
	}

	if err := provider.Cancel(context.Background(), logistics.CancelRequest{ProviderReference: "KWK-ORD-5D21B8", Reason: "buyer cancelled"}); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	tracking, err := provider.Track(context.Background(), logistics.TrackRequest{ProviderReference: "KWK-ORD-5D21B8", TrackingNumber: "KWI1234567890"})
	if err != nil || tracking.Status != logistics.StatusInTransit || len(tracking.Events) != 1 {
		t.Fatalf("unexpected tracking: %+v err=%v", tracking, err)
	}
	coverage, err := provider.Coverage(context.Background())
	if err != nil || len(coverage) != 1 || coverage[0].CountryCode != "NG" {
		t.Fatalf("unexpected coverage: %+v err=%v", coverage, err)
	}
	for i, key := range apiKeys {
		if key != "pk_test_kwikpik_v2" {
			t.Fatalf("expected x-api-key header on request %d (%s %s), got %q", i, methods[i], paths[i], key)
		}
	}
}

func TestKwikpikV2WebhookSignatureTimestampAndEvents(t *testing.T) {
	fixedNow := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	provider, err := kwikpik.NewProvider(kwikpik.Config{
		BaseUrl:       kwikpik.DefaultBaseURL,
		ApiKey:        "pk_live_test",
		WebhookSecret: "super-secret-key",
		ContactEmail:  "logistics@nantty.com",
		Now:           func() time.Time { return fixedNow },
	})
	if err != nil {
		t.Fatalf("new provider: %v", err)
	}

	payload := `{"event":"package.status_changed","timestamp":"2026-11-16T10:00:00Z","data":{"trackingId":"KWI1234567890","merchantPackageNumber":"MPN-1","orderCode":"KWK-ORD-5D21B8","previousStatus":"PENDING","status":"PICKED_UP","statusCode":"PICKED_UP"}}`

	sign := func(ts int64, body string) string {
		mac := hmac.New(sha256.New, []byte("super-secret-key"))
		mac.Write([]byte(fmt.Sprintf("%d.%s", ts, body)))
		return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
	}

	staleReq := httptest.NewRequest(http.MethodPost, "/api/v1/logistics/webhooks/kwikpik", bytes.NewBufferString(payload))
	staleReq.Header.Set("X-Kwikpik-Signature", sign(fixedNow.Add(-10*time.Minute).Unix(), payload))
	if _, err := provider.ParseWebhook(staleReq); err != kwikpik.ErrWebhookUnauthorized {
		t.Fatalf("expected stale timestamp rejection, got %v", err)
	}

	okReq := httptest.NewRequest(http.MethodPost, "/api/v1/logistics/webhooks/kwikpik", bytes.NewBufferString(payload))
	okReq.Header.Set("X-Kwikpik-Webhook-Id", "wh-123")
	okReq.Header.Set("X-Kwikpik-Event", "package.status_changed")
	okReq.Header.Set("X-Kwikpik-Signature", sign(fixedNow.Unix(), payload))
	ev, err := provider.ParseWebhook(okReq)
	if err != nil || ev.ProviderEventId != "wh-123" || ev.ProviderReference != "KWK-ORD-5D21B8" || ev.Status != logistics.StatusPickedUp {
		t.Fatalf("unexpected parsed webhook: %+v err=%v", ev, err)
	}

	batchPayload := `{"event":"package.assigned","timestamp":"2026-11-16T10:00:00Z","data":{"packages":[{"trackingId":"KWI999","merchantPackageNumber":"MPN-9","orderCode":"KWK-ORD-9","status":"AWAITING_PICKUP"}],"rider":{"id":"r1","name":"Rider"}}}`
	batchReq := httptest.NewRequest(http.MethodPost, "/api/v1/logistics/webhooks/kwikpik", bytes.NewBufferString(batchPayload))
	batchReq.Header.Set("X-Kwikpik-Webhook-Id", "wh-batch-1")
	batchReq.Header.Set("X-Kwikpik-Signature", sign(fixedNow.Unix(), batchPayload))
	batchEv, err := provider.ParseWebhook(batchReq)
	if err != nil || batchEv.ProviderReference != "KWK-ORD-9" || batchEv.Payload["trackingId"] != "KWI999" || batchEv.Status != logistics.StatusBooked {
		t.Fatalf("unexpected batch assigned webhook: %+v err=%v", batchEv, err)
	}
}

func TestKwikpikRejectsMissingPriceAndInsurance(t *testing.T) {
	for _, body := range []string{
		`{"currency":"NGN"}`,
		`{"currency":"NGN","totalEstimatedPrice":null}`,
		`{"currency":"NGN","totalEstimatedPrice":0}`,
		`{"currency":"NGN","totalEstimatedPrice":100,"totalInsurancePremium":1}`,
		`{"currency":"NGN","totalEstimatedPrice":100,"packages":[{"insurancePremium":1}]}`,
	} {
		t.Run(body, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, body) }))
			defer server.Close()
			provider, err := kwikpik.NewProvider(kwikpik.Config{BaseUrl: server.URL, ApiKey: "test", ContactEmail: "logistics@nantty.com", AllowInsecureDev: true})
			if err != nil {
				t.Fatal(err)
			}
			if _, err := provider.Quote(context.Background(), logistics.QuoteRequest{Currency: "NGN"}); err == nil {
				t.Fatal("invalid quote must be rejected")
			}
		})
	}
}
