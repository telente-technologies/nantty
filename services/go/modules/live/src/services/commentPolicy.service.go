package services

import (
	"strings"
	"time"
	"unicode"

	liveerrors "zudomart/modules/live/src/errors"
)

const (
	maximumCommentCharacters = 300
	minimumCommentGap        = time.Second
	maximumBlockedWords      = 100
	maximumBlockedWordLength = 30
	maximumSlowModeSeconds   = 300
)

var confusableCharacters = map[rune]rune{'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's'}

func NormaliseCommentText(raw string) (string, error) {
	cleaned := strings.Map(func(character rune) rune {
		if unicode.IsControl(character) && character != '\n' {
			return -1
		}
		return character
	}, raw)
	collapsed := strings.Join(strings.Fields(cleaned), " ")
	if collapsed == "" {
		return "", liveerrors.Unprocessable("COMMENT_EMPTY", "Write a comment first.")
	}
	if len([]rune(collapsed)) > maximumCommentCharacters {
		return "", liveerrors.Unprocessable("COMMENT_TOO_LONG", "Comments can be at most 300 characters.")
	}
	return collapsed, nil
}

func foldForWordMatching(text string) string {
	var builder strings.Builder
	separatorPending := true
	for _, character := range strings.ToLower(text) {
		character = foldFullwidth(character)
		if replacement, confusable := confusableCharacters[character]; confusable {
			character = replacement
		}
		if unicode.IsLetter(character) || unicode.IsDigit(character) {
			builder.WriteRune(character)
			separatorPending = false
		} else if !separatorPending {
			builder.WriteRune(' ')
			separatorPending = true
		}
	}
	return strings.TrimSpace(builder.String())
}

func foldFullwidth(character rune) rune {
	if character >= 0xFF01 && character <= 0xFF5E {
		return unicode.ToLower(character - 0xFEE0)
	}
	return character
}

func foldSymbols(text string) string {
	return strings.Map(func(character rune) rune {
		if character == '\uFE0F' || character == '\u200D' || unicode.IsSpace(character) {
			return -1
		}
		return foldFullwidth(unicode.ToLower(character))
	}, text)
}

func FindBlockedWord(text string, blockedWords ...[]string) (string, bool) {
	padded := " " + foldForWordMatching(text) + " "
	symbols := foldSymbols(text)
	for _, list := range blockedWords {
		for _, word := range list {
			folded := foldForWordMatching(word)
			if folded != "" && strings.Contains(padded, " "+folded+" ") {
				return word, true
			}
			if raw := foldSymbols(word); folded == "" && raw != "" && strings.Contains(symbols, raw) {
				return word, true
			}
		}
	}
	return "", false
}

func NormaliseBlockedWords(raw []string) ([]string, error) {
	seen := map[string]bool{}
	cleaned := make([]string, 0, len(raw))
	for _, word := range raw {
		trimmed := strings.ToLower(strings.TrimSpace(word))
		if trimmed == "" || seen[trimmed] {
			continue
		}
		minimum := 2
		if foldForWordMatching(trimmed) == "" {
			minimum = 1
		}
		if len([]rune(trimmed)) < minimum || len([]rune(trimmed)) > maximumBlockedWordLength {
			return nil, liveerrors.Unprocessable("BLOCKED_WORD_INVALID", "Blocked words must be 2-30 characters.")
		}
		seen[trimmed] = true
		cleaned = append(cleaned, trimmed)
	}
	if len(cleaned) > maximumBlockedWords {
		return nil, liveerrors.Unprocessable("BLOCKED_WORDS_LIMIT", "You can block at most 100 words.")
	}
	return cleaned, nil
}

func SlowModeWaitRemaining(lastCommentAt, now time.Time, slowModeSeconds int) time.Duration {
	gap := time.Duration(slowModeSeconds) * time.Second
	if gap < minimumCommentGap {
		gap = minimumCommentGap
	}
	if remaining := gap - now.Sub(lastCommentAt); remaining > 0 {
		return remaining
	}
	return 0
}
