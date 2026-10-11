package services

import (
	"strings"
	"testing"
	"time"
)

func TestNormaliseCommentTextCollapsesWhitespaceAndStripsControlCharacters(t *testing.T) {
	cleaned, err := NormaliseCommentText("  hello \t\u0007  world \n ")
	if err != nil || cleaned != "hello world" {
		t.Fatalf("got %q %v", cleaned, err)
	}
	for _, rejected := range []string{"", "   ", "\u0007\u0008", strings.Repeat("é", 301)} {
		if _, err := NormaliseCommentText(rejected); err == nil {
			t.Fatalf("%q must be rejected", rejected)
		}
	}
	if _, err := NormaliseCommentText(strings.Repeat("é", 300)); err != nil {
		t.Fatalf("300 characters are allowed: %v", err)
	}
}

func TestFindBlockedWordMatchesWholeWordsPhrasesAndLookalikes(t *testing.T) {
	blocked := []string{"scam", "rip off", "Bad Word"}
	matching := []string{"it is a SCAM!", "total sc4m", "this is a rip-off", "RIP   OFF", "bad.word here", "$cam alert"}
	for _, text := range matching {
		if _, found := FindBlockedWord(text, blocked); !found {
			t.Fatalf("%q must match", text)
		}
	}
	for _, text := range []string{"scammers aside", "i love this", "skip off", "badword"} {
		if word, found := FindBlockedWord(text, blocked); found {
			t.Fatalf("%q must not match, matched %q", text, word)
		}
	}
	if _, found := FindBlockedWord("platform rule", nil, []string{"rule"}); !found {
		t.Fatalf("every list is consulted")
	}
	if _, found := FindBlockedWord("anything", nil, []string{"", "  "}); found {
		t.Fatalf("empty entries never match")
	}
}

func TestFindBlockedWordHandlesCaseFullwidthAndEmoji(t *testing.T) {
	blocked := []string{"bad", "🍑", "❤️🔥"}
	for _, text := range []string{"BAD", "BaD vibes", "b4d", "bad😀", "😀bad😀", "ｂａｄ", "ＢＡＤ!", "nice 🍑", "🍑🍑", "❤🔥 yes", "❤️🔥"} {
		if _, found := FindBlockedWord(text, blocked); !found {
			t.Fatalf("%q must match", text)
		}
	}
	for _, text := range []string{"badge", "abad", "🍒 only", "❤️ only", "fine"} {
		if word, found := FindBlockedWord(text, blocked); found {
			t.Fatalf("%q must not match, matched %q", text, word)
		}
	}
}

func TestNormaliseBlockedWordsDeduplicatesAndEnforcesLimits(t *testing.T) {
	cleaned, err := NormaliseBlockedWords([]string{" Scam ", "scam", "", "Rip Off"})
	if err != nil || len(cleaned) != 2 || cleaned[0] != "scam" || cleaned[1] != "rip off" {
		t.Fatalf("got %v %v", cleaned, err)
	}
	if _, err := NormaliseBlockedWords([]string{"a"}); err == nil {
		t.Fatalf("one character words are rejected")
	}
	if emoji, err := NormaliseBlockedWords([]string{"🍑"}); err != nil || len(emoji) != 1 {
		t.Fatalf("a single emoji can be blocked: %v %v", emoji, err)
	}
	if _, err := NormaliseBlockedWords([]string{strings.Repeat("x", 31)}); err == nil {
		t.Fatalf("long words are rejected")
	}
	tooMany := make([]string, 101)
	for index := range tooMany {
		tooMany[index] = "word" + strings.Repeat("a", index%20) + string(rune('a'+index%26)) + string(rune('a'+index/26))
	}
	if _, err := NormaliseBlockedWords(tooMany); err == nil {
		t.Fatalf("more than 100 words are rejected")
	}
}

func TestSlowModeWaitRemainingHonoursTheConfiguredGapAndTheMinimum(t *testing.T) {
	now := time.Now()
	if wait := SlowModeWaitRemaining(now.Add(-4*time.Second), now, 10); wait != 6*time.Second {
		t.Fatalf("got %v", wait)
	}
	if wait := SlowModeWaitRemaining(now.Add(-11*time.Second), now, 10); wait != 0 {
		t.Fatalf("got %v", wait)
	}
	if wait := SlowModeWaitRemaining(now.Add(-300*time.Millisecond), now, 0); wait <= 0 {
		t.Fatalf("the one second floor applies without slow mode, got %v", wait)
	}
	if wait := SlowModeWaitRemaining(now.Add(-2*time.Second), now, 0); wait != 0 {
		t.Fatalf("got %v", wait)
	}
}

func TestMentionBoundsUseUtf16OffsetsLikeSocial(t *testing.T) {
	text := "😀 @friend"
	units := []uint16{0xd83d, 0xde00, ' ', '@', 'f', 'r', 'i', 'e', 'n', 'd'}
	if !mentionStartsWithAt(units, 3, 7) {
		t.Fatalf("@friend starts at UTF-16 offset 3 in %q", text)
	}
	for _, bad := range [][2]int{{2, 7}, {3, 8}, {-1, 3}, {3, 1}} {
		if mentionStartsWithAt(units, bad[0], bad[1]) {
			t.Fatalf("%v must be out of bounds", bad)
		}
	}
}
