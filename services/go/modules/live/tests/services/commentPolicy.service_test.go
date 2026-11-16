package services

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/interfaces"
	liveservices "nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

func TestNormaliseCommentTextCollapsesWhitespaceAndStripsControlCharacters(t *testing.T) {
	cleaned, err := liveservices.NormaliseCommentText("  hello \t\u0007  world \n ")
	if err != nil || cleaned != "hello world" {
		t.Fatalf("got %q %v", cleaned, err)
	}
	for _, rejected := range []string{"", "   ", "\u0007\u0008", strings.Repeat("é", 301)} {
		if _, err := liveservices.NormaliseCommentText(rejected); err == nil {
			t.Fatalf("%q must be rejected", rejected)
		}
	}
	if _, err := liveservices.NormaliseCommentText(strings.Repeat("é", 300)); err != nil {
		t.Fatalf("300 characters are allowed: %v", err)
	}
}

func TestFindBlockedWordMatchesWholeWordsPhrasesAndLookalikes(t *testing.T) {
	blocked := []string{"scam", "rip off", "Bad Word"}
	matching := []string{"it is a SCAM!", "total sc4m", "this is a rip-off", "RIP   OFF", "bad.word here", "$cam alert"}
	for _, text := range matching {
		if _, found := liveservices.FindBlockedWord(text, blocked); !found {
			t.Fatalf("%q must match", text)
		}
	}
	for _, text := range []string{"scammers aside", "i love this", "skip off", "badword"} {
		if word, found := liveservices.FindBlockedWord(text, blocked); found {
			t.Fatalf("%q must not match, matched %q", text, word)
		}
	}
	if _, found := liveservices.FindBlockedWord("platform rule", nil, []string{"rule"}); !found {
		t.Fatalf("every list is consulted")
	}
	if _, found := liveservices.FindBlockedWord("anything", nil, []string{"", "  "}); found {
		t.Fatalf("empty entries never match")
	}
}

func TestFindBlockedWordHandlesCaseFullwidthAndEmoji(t *testing.T) {
	blocked := []string{"bad", "🍑", "❤️🔥"}
	for _, text := range []string{"BAD", "BaD vibes", "b4d", "bad😀", "😀bad😀", "ｂａｄ", "ＢＡＤ!", "nice 🍑", "🍑🍑", "❤🔥 yes", "❤️🔥"} {
		if _, found := liveservices.FindBlockedWord(text, blocked); !found {
			t.Fatalf("%q must match", text)
		}
	}
	for _, text := range []string{"badge", "abad", "🍒 only", "❤️ only", "fine"} {
		if word, found := liveservices.FindBlockedWord(text, blocked); found {
			t.Fatalf("%q must not match, matched %q", text, word)
		}
	}
}

func TestNormaliseBlockedWordsDeduplicatesAndEnforcesLimits(t *testing.T) {
	cleaned, err := liveservices.NormaliseBlockedWords([]string{" Scam ", "scam", "", "Rip Off"})
	if err != nil || len(cleaned) != 2 || cleaned[0] != "scam" || cleaned[1] != "rip off" {
		t.Fatalf("got %v %v", cleaned, err)
	}
	if _, err := liveservices.NormaliseBlockedWords([]string{"a"}); err == nil {
		t.Fatalf("one character words are rejected")
	}
	if emoji, err := liveservices.NormaliseBlockedWords([]string{"🍑"}); err != nil || len(emoji) != 1 {
		t.Fatalf("a single emoji can be blocked: %v %v", emoji, err)
	}
	if _, err := liveservices.NormaliseBlockedWords([]string{strings.Repeat("x", 31)}); err == nil {
		t.Fatalf("long words are rejected")
	}
	tooMany := make([]string, 101)
	for index := range tooMany {
		tooMany[index] = "word" + strings.Repeat("a", index%20) + string(rune('a'+index%26)) + string(rune('a'+index/26))
	}
	if _, err := liveservices.NormaliseBlockedWords(tooMany); err == nil {
		t.Fatalf("more than 100 words are rejected")
	}
}

func TestSlowModeWaitRemainingHonoursTheConfiguredGapAndTheMinimum(t *testing.T) {
	now := time.Now()
	if wait := liveservices.SlowModeWaitRemaining(now.Add(-4*time.Second), now, 10); wait != 6*time.Second {
		t.Fatalf("got %v", wait)
	}
	if wait := liveservices.SlowModeWaitRemaining(now.Add(-11*time.Second), now, 10); wait != 0 {
		t.Fatalf("got %v", wait)
	}
	if wait := liveservices.SlowModeWaitRemaining(now.Add(-300*time.Millisecond), now, 0); wait <= 0 {
		t.Fatalf("the one second floor applies without slow mode, got %v", wait)
	}
	if wait := liveservices.SlowModeWaitRemaining(now.Add(-2*time.Second), now, 0); wait != 0 {
		t.Fatalf("got %v", wait)
	}
}

func TestMentionBoundsUseUtf16OffsetsLikeSocial(t *testing.T) {
	text := "😀 @friend"
	target := uuid.New()
	author := uuid.New()
	service := liveservices.NewLiveService(&container.Container{
		Directory: mentionDirectory{participant: interfaces.Participant{Id: target, Username: "@friend"}},
		Relations: mentionRelations{},
	})
	resolved, err := service.ResolveCommentMentions(context.Background(), author, text, []types.CommentMentionInput{{UserId: target.String(), Start: 3, Length: 7}})
	if err != nil || len(resolved.Views) != 1 || resolved.Views[0].Start != 3 || resolved.Views[0].Length != 7 {
		t.Fatalf("@friend starts at UTF-16 offset 3 in %q: %+v err=%v", text, resolved, err)
	}
	for _, bad := range [][2]int{{2, 7}, {3, 8}, {-1, 3}, {3, 1}} {
		resolved, err := service.ResolveCommentMentions(context.Background(), author, text, []types.CommentMentionInput{{UserId: target.String(), Start: bad[0], Length: bad[1]}})
		if err != nil || len(resolved.Views) != 0 {
			t.Fatalf("%v must be excluded from resolved mentions: %+v err=%v", bad, resolved, err)
		}
	}
}

type mentionDirectory struct{ participant interfaces.Participant }

func (directory mentionDirectory) LookupParticipants(_ context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	participants := map[uuid.UUID]interfaces.Participant{}
	for _, identifier := range identifiers {
		if identifier == directory.participant.Id {
			participants[identifier] = directory.participant
		}
	}
	return participants, nil
}

type mentionRelations struct{}

func (mentionRelations) BlockedEitherWay(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]bool, error) {
	return map[uuid.UUID]bool{}, nil
}
func (mentionRelations) IsFollowing(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return false, nil
}
func (mentionRelations) FollowCounts(context.Context, uuid.UUID) (int, int, error) { return 0, 0, nil }
func (mentionRelations) IsActiveSubscriber(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return false, nil
}
func (mentionRelations) MentionPrivacyOf(_ context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.MentionPrivacy, error) {
	privacy := map[uuid.UUID]interfaces.MentionPrivacy{}
	for _, identifier := range identifiers {
		privacy[identifier] = interfaces.MentionEveryone
	}
	return privacy, nil
}
func (mentionRelations) ListLiveAlertRecipients(context.Context, uuid.UUID, int) ([]uuid.UUID, bool, error) {
	return nil, false, nil
}
func (mentionRelations) FollowedAmong(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]bool, error) {
	return map[uuid.UUID]bool{}, nil
}
func (mentionRelations) PrivateAccountsAmong(context.Context, []uuid.UUID) (map[uuid.UUID]bool, error) {
	return map[uuid.UUID]bool{}, nil
}
