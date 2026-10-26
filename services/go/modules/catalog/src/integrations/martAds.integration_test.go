package integrations

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/interfaces"
)

const adsSecret = "a-shared-secret-of-at-least-32-chars"

func adsSignatureIsValid(request *http.Request, body []byte) bool {
	bodyHash := sha256.Sum256(body)
	canonical := "v1\n" + request.Method + "\n" + request.URL.RequestURI() + "\n" + request.Header.Get("x-zudo-timestamp") + "\n" + request.Header.Get("x-zudo-nonce") + "\n" + hex.EncodeToString(bodyHash[:])
	mac := hmac.New(sha256.New, []byte(adsSecret))
	mac.Write([]byte(canonical))
	return len(request.Header.Get("x-zudo-nonce")) >= 16 && hmac.Equal([]byte(request.Header.Get("x-zudo-signature")), []byte("v1="+hex.EncodeToString(mac.Sum(nil))))
}

func TestMartAdsAsksForAMartTileWithASignedRequest(t *testing.T) {
	productId := uuid.NewString()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		if request.URL.Path != "/internal/v1/ads/decide" || !adsSignatureIsValid(request, body) {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		var decide martDecideRequest
		if json.Unmarshal(body, &decide) != nil || decide.Slot["kind"] != "martTile" || decide.Viewer["country"] != "NG" {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		_, _ = writer.Write([]byte(`{"ad":{"adId":"ad_1","impressionToken":"imp_1","label":"Sponsored","clickLinks":{"cta":"https://ads/c"},"creative":{"type":"single","headline":"","primaryText":"Fresh drop","callToAction":"Shop now","source":{"type":"product","id":"` + productId + `"},"destination":{"type":"product","targetId":"` + productId + `"},"identity":{"name":"Adaeze Styles"},"media":[{"url":"https://cdn/ad.jpg"}]}}}`))
	}))
	defer server.Close()
	client := NewHttpMartAds(server.URL, adsSecret)
	ad, err := client.DecideMartTile(context.Background(), interfaces.MartAdRequest{Viewer: uuid.New(), Country: "NG"})
	if err != nil || ad == nil {
		t.Fatalf("expected an ad, got %v %v", ad, err)
	}
	if ad.ProductId != productId || ad.AdvertiserName != "Adaeze Styles" || ad.ImpressionToken != "imp_1" || ad.ImageUrl != "https://cdn/ad.jpg" || ad.ClickLinks == nil || ad.ClickLinks.Cta != "https://ads/c" {
		t.Fatalf("unexpected ad %+v", ad)
	}
}

func TestMartAdsReportsOutagesAndNoFill(t *testing.T) {
	failing := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusServiceUnavailable) }))
	defer failing.Close()
	if _, err := NewHttpMartAds(failing.URL, adsSecret).DecideMartTile(context.Background(), interfaces.MartAdRequest{Viewer: uuid.New()}); err == nil {
		t.Fatal("a 503 must be an error")
	}
	slow := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { time.Sleep(1200 * time.Millisecond) }))
	defer slow.Close()
	if _, err := NewHttpMartAds(slow.URL, adsSecret).DecideMartTile(context.Background(), interfaces.MartAdRequest{Viewer: uuid.New()}); err == nil {
		t.Fatal("a slow ads service must time out")
	}
	empty := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"ad":null,"declinedReason":"no_eligible_ads"}`))
	}))
	defer empty.Close()
	if ad, err := NewHttpMartAds(empty.URL, adsSecret).DecideMartTile(context.Background(), interfaces.MartAdRequest{Viewer: uuid.New()}); ad != nil || err != nil {
		t.Fatalf("no fill must be nil, nil; got %v %v", ad, err)
	}
	if ad, err := NewHttpMartAds("", "").DecideMartTile(context.Background(), interfaces.MartAdRequest{Viewer: uuid.New()}); ad != nil || err != nil {
		t.Fatal("an unconfigured client must stay quiet")
	}
}
