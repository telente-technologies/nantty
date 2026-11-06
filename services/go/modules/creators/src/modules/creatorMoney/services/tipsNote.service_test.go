package services

import (
	"strings"
	"testing"
	"unicode/utf8"

	ledgerutils "nantty/modules/ledger/src/utils"
)

func TestTipNoteNormalizationAndIdempotencyFingerprint(t *testing.T) {
	base := TipRequest{TargetType: "live", TargetId: "live-1", Coins: 100}
	if got, want := tipRequestHash(base), ledgerutils.HashRequestFingerprint(base.TargetType, base.TargetId, base.Coins); got != want {
		t.Fatalf("empty note must preserve legacy request fingerprint: got %q want %q", got, want)
	}

	withNote := base
	withNote.Note = NormalizeTipNote("  Thanks for the stream!  ")
	trimmed := base
	trimmed.Note = "Thanks for the stream!"
	if tipRequestHash(withNote) != tipRequestHash(trimmed) {
		t.Fatal("surrounding whitespace must not change a normalized note fingerprint")
	}
	changed := base
	changed.Note = "Different note"
	if tipRequestHash(withNote) == tipRequestHash(changed) {
		t.Fatal("changed note must change the idempotency fingerprint")
	}
}

func TestTipNoteLengthCountsUnicodeCharacters(t *testing.T) {
	accepted := strings.Repeat("é", MaximumTipNoteRunes)
	if got := utf8.RuneCountInString(NormalizeTipNote(accepted)); got != MaximumTipNoteRunes {
		t.Fatalf("accepted note has %d runes, want %d", got, MaximumTipNoteRunes)
	}
	rejected := strings.Repeat("é", MaximumTipNoteRunes+1)
	if got := utf8.RuneCountInString(NormalizeTipNote(rejected)); got <= MaximumTipNoteRunes {
		t.Fatalf("over-limit note has %d runes, want more than %d", got, MaximumTipNoteRunes)
	}
}
