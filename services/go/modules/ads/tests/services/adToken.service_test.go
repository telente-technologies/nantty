package services_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"nantty/modules/ads/src/services"
)

func newTestSigner(now *time.Time) services.AdTokenSigner {
	return services.AdTokenSigner{ActiveKeyId: "k2", Keys: map[string][]byte{"k1": []byte("old-secret-old-secret-old-secret!"), "k2": []byte("new-secret-new-secret-new-secret!")}, TimeToLive: time.Hour, Now: func() time.Time { return *now }}
}

func TestAdTokenRoundTripBindsViewer(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	signer := newTestSigner(&now)
	token, err := signer.Sign(services.AdTokenClaims{ImpressionId: "imp-1", UserId: "user-1", PriceMicros: 1234})
	if err != nil {
		t.Fatal(err)
	}
	claims, err := signer.Verify(token, "user-1")
	if err != nil || claims.ImpressionId != "imp-1" || claims.PriceMicros != 1234 {
		t.Fatalf("unexpected claims %+v err %v", claims, err)
	}
	if _, err := signer.Verify(token, "someone-else"); !errors.Is(err, services.ErrAdTokenUserMismatch) {
		t.Fatalf("expected user mismatch, got %v", err)
	}
}

func TestAdTokenRejectsTamperingExpiryAndUnknownKeys(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	signer := newTestSigner(&now)
	token, _ := signer.Sign(services.AdTokenClaims{ImpressionId: "imp-1", UserId: "user-1", PriceMicros: 10})
	parts := strings.Split(token, ".")
	forged, _ := signer.Sign(services.AdTokenClaims{ImpressionId: "imp-1", UserId: "user-1", PriceMicros: 99_999_999})
	forgedParts := strings.Split(forged, ".")
	tampered := strings.Join([]string{parts[0], parts[1], forgedParts[2], parts[3]}, ".")
	if _, err := signer.Verify(tampered, "user-1"); !errors.Is(err, services.ErrAdTokenSignature) {
		t.Fatalf("payload swap must fail signature, got %v", err)
	}
	if _, err := signer.Verify("garbage", "user-1"); !errors.Is(err, services.ErrAdTokenMalformed) {
		t.Fatalf("expected malformed, got %v", err)
	}
	unknownKey := strings.Join([]string{parts[0], "k9", parts[2], parts[3]}, ".")
	if _, err := signer.Verify(unknownKey, "user-1"); !errors.Is(err, services.ErrAdTokenSignature) {
		t.Fatalf("unknown key must fail, got %v", err)
	}
	later := now.Add(2 * time.Hour)
	expiredSigner := newTestSigner(&later)
	if _, err := expiredSigner.Verify(token, "user-1"); !errors.Is(err, services.ErrAdTokenExpired) {
		t.Fatalf("expected expiry, got %v", err)
	}
}

func TestAdTokenSignedWithRotatedOutKeyStillVerifies(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	oldSigner := newTestSigner(&now)
	oldSigner.ActiveKeyId = "k1"
	token, _ := oldSigner.Sign(services.AdTokenClaims{ImpressionId: "imp-2", UserId: "u"})
	if _, err := newTestSigner(&now).Verify(token, "u"); err != nil {
		t.Fatalf("previous key must remain valid during rotation: %v", err)
	}
}
