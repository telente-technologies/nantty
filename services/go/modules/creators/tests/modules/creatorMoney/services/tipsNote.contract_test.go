package services_test

import (
	"strings"
	"testing"
	"unicode/utf8"

	"nantty/modules/creators/src/modules/creatorMoney/services"
)

func TestTipNoteNormalizationPreservesUnicodeAndTrimsOuterWhitespace(t *testing.T) {
	accepted := strings.Repeat("é", 500)
	if got := services.NormalizeTipNote("  " + accepted + "  "); got != accepted || utf8.RuneCountInString(got) != 500 {
		t.Fatalf("normalized Unicode note = %q (%d runes)", got, utf8.RuneCountInString(got))
	}
}
