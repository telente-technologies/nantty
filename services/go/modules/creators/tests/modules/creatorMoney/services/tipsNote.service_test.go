package services_test

import (
	"testing"

	"nantty/modules/creators/src/modules/creatorMoney/services"
	ledgerutils "nantty/modules/ledger/src/utils"
)

func TestTipNoteNormalizationAndIdempotencyFingerprint(t *testing.T) {
	base := services.TipRequest{TargetType: "live", TargetId: "live-1", Coins: 100}
	if got, want := services.TipRequestFingerprint(base), ledgerutils.HashRequestFingerprint(base.TargetType, base.TargetId, base.Coins); got != want {
		t.Fatalf("empty note must preserve legacy request fingerprint: got %q want %q", got, want)
	}

	withNote := base
	withNote.Note = services.NormalizeTipNote("  Thanks for the stream!  ")
	trimmed := base
	trimmed.Note = "Thanks for the stream!"
	if services.TipRequestFingerprint(withNote) != services.TipRequestFingerprint(trimmed) {
		t.Fatal("surrounding whitespace must not change a normalized note fingerprint")
	}
	changed := base
	changed.Note = "Different note"
	if services.TipRequestFingerprint(withNote) == services.TipRequestFingerprint(changed) {
		t.Fatal("changed note must change the idempotency fingerprint")
	}
}
