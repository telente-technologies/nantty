package auth_test

import (
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"

	production "nantty/modules/auth/src/modules/developerProduction"
)

func TestProductionMessageCursorRoundTrip(t *testing.T) {
	for _, kind := range []string{"message", "conversation"} {
		want := production.BusinessApiCursor{Kind: kind, CreatedAt: time.Date(2026, 11, 25, 14, 30, 12, 123456789, time.FixedZone("UTC+1", 3600)), ResourceID: uuid.New()}
		encoded := production.EncodeBusinessApiCursor(want)
		got, err := production.DecodeBusinessApiCursor(encoded)
		if err != nil {
			t.Fatalf("decode %s cursor: %v", kind, err)
		}
		if got.Kind != want.Kind || !got.CreatedAt.Equal(want.CreatedAt) || got.ResourceID != want.ResourceID {
			t.Fatalf("%s cursor round-trip = %+v, want %+v", kind, got, want)
		}
	}
}

func TestProductionMessageCursorRejectsMalformedValues(t *testing.T) {
	for _, value := range []string{"not-base64", "", "MQp4", "MSNub3QtYS10aW1lc3RhbXB8MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAw", production.EncodeBusinessApiCursor(production.BusinessApiCursor{Kind: "other", CreatedAt: time.Now(), ResourceID: uuid.New()})} {
		if _, err := production.DecodeBusinessApiCursor(value); err == nil {
			t.Fatalf("expected invalid cursor %q to be rejected", value)
		}
	}
}

func TestProductionMessagePageSizeBounds(t *testing.T) {
	tests := []struct {
		value string
		want  int
		valid bool
	}{
		{value: "", want: 20, valid: true},
		{value: "1", want: 1, valid: true},
		{value: "100", want: 100, valid: true},
		{value: "0"},
		{value: "101"},
		{value: "1.5"},
		{value: "-1"},
	}
	for _, test := range tests {
		got, err := production.ParseBusinessPageSize(url.Values{"limit": []string{test.value}})
		if test.valid && (err != nil || got != test.want) {
			t.Errorf("limit %q = %d, %v; want %d", test.value, got, err, test.want)
		}
		if !test.valid && err == nil {
			t.Errorf("limit %q was accepted", test.value)
		}
	}
}
