package integrations_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nantty/modules/moderation/src/integrations"
)

func TestIntelligenceAudioMatchAdvisorSignsRequestsTheWayIntelligenceVerifiesThem(t *testing.T) {
	const secret = "secret-only-for-tests-0123456789abcdef"
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		digest := sha256.Sum256(body)
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte("v1\nPOST\n" + request.URL.Path + "\n" + request.Header.Get("x-nantty-timestamp") + "\n" + request.Header.Get("x-nantty-nonce") + "\n" + hex.EncodeToString(digest[:])))
		if request.Header.Get("x-nantty-signature") != "v1="+hex.EncodeToString(mac.Sum(nil)) || request.URL.Path != "/v1/audio/copyright-matches" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		var payload map[string]any
		_ = json.Unmarshal(body, &payload)
		if payload["referenceMediaId"] != "ref" {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		_, _ = writer.Write([]byte(`{"claimId":"c1","advisory":true,"available":true,"fingerprintSource":"chromaprint","matches":[{"targetMediaId":"m1","confidencePercent":91,"targetStartSeconds":0,"targetEndSeconds":20,"referenceStartSeconds":10}]}`))
	}))
	defer server.Close()
	advisor := integrations.NewIntelligenceAudioMatchAdvisor(server.URL, secret, 5*time.Second)
	result, err := advisor.MatchCopyrightAudio(context.Background(), "c1", "ref", []string{"m1"})
	if err != nil || !result.Available || len(result.Matches) != 1 || result.Matches[0].ConfidencePercent != 91 {
		t.Fatalf("unexpected %+v %v", result, err)
	}
	if _, err := integrations.NewIntelligenceAudioMatchAdvisor("", "", time.Second).MatchCopyrightAudio(context.Background(), "c1", "ref", nil); !errors.Is(err, integrations.ErrAudioMatchUnavailable) {
		t.Fatal("an unconfigured advisor reports unavailable")
	}
}
