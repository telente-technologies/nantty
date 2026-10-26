package services

import (
	"testing"
	"time"

	"nantty/modules/auth/src/generated/ent"
)

func TestChooseActiveSigningKeyWaitsForJwksCachesBeforeActivating(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	retiredAt := now.Add(-time.Hour)
	brandNew := &ent.SigningKey{ID: "brand-new", CreatedAt: now.Add(-time.Minute)}
	established := &ent.SigningKey{ID: "established", CreatedAt: now.Add(-30 * 24 * time.Hour)}
	retired := &ent.SigningKey{ID: "retired", CreatedAt: now.Add(-60 * 24 * time.Hour), RetiredAt: &retiredAt}
	cases := []struct {
		name string
		keys []*ent.SigningKey
		want string
	}{
		{"new key is published but not yet signing", []*ent.SigningKey{brandNew, established, retired}, "established"},
		{"first key ever signs immediately", []*ent.SigningKey{brandNew}, "brand-new"},
		{"activated key after the delay", []*ent.SigningKey{{ID: "aged", CreatedAt: now.Add(-21 * time.Minute)}, established}, "aged"},
		{"only retired keys", []*ent.SigningKey{retired}, ""},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			chosen := ChooseActiveSigningKey(testCase.keys, now, 20*time.Minute)
			got := ""
			if chosen != nil {
				got = chosen.ID
			}
			if got != testCase.want {
				t.Fatalf("got %q, want %q", got, testCase.want)
			}
		})
	}
}
