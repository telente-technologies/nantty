package usernames

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

const (
	MinimumLength = 3
	MaximumLength = 30
)

type UnavailableReason string

const (
	ReasonTaken        UnavailableReason = "taken"
	ReasonReserved     UnavailableReason = "reserved"
	ReasonInvalid      UnavailableReason = "invalid"
	ReasonRecentlyUsed UnavailableReason = "recently_used"
	ReasonWithheld     UnavailableReason = "withheld"
)

var allowedCharacters = regexp.MustCompile(`^[a-z0-9._]+$`)

var lookalikeCharacters = map[rune]string{
	'0': "o", '1': "l", '!': "l", '|': "l", 'i': "l", '3': "e", '4': "a", '@': "a", '5': "s", '$': "s", '7': "t", '8': "b", '9': "g", '6': "g", '2': "z",
	'а': "a", 'е': "e", 'о': "o", 'р': "p", 'с': "c", 'у': "y", 'х': "x", 'і': "l", 'ј': "j", 'ѕ': "s", 'ԁ': "d", 'ɡ': "g", 'к': "k", 'м': "m",
	'т': "t", 'в': "b", 'н': "h", 'ո': "n", 'ս': "u", 'α': "a", 'β': "b", 'ε': "e", 'ι': "l", 'κ': "k", 'ν': "v", 'ο': "o", 'ρ': "p", 'τ': "t",
	'υ': "u", 'χ': "x", 'ω': "w", 'ı': "l", 'ł': "l", 'ø': "o", 'đ': "d", 'ß': "ss",
}

func NormalizeRequestedUsername(raw string) string {
	trimmed := strings.TrimSpace(norm.NFKC.String(raw))
	return strings.ToLower(strings.TrimPrefix(trimmed, "@"))
}

func HasValidFormat(username string) bool {
	if len(username) < MinimumLength || len(username) > MaximumLength || !allowedCharacters.MatchString(username) {
		return false
	}
	hasLetter := strings.ContainsFunc(username, func(character rune) bool { return character >= 'a' && character <= 'z' })
	return hasLetter && !strings.HasPrefix(username, ".") && !strings.HasSuffix(username, ".") && !strings.Contains(username, "..")
}

func BuildConfusableSkeleton(value string) string {
	var mapped strings.Builder
	for _, character := range norm.NFKD.String(strings.ToLower(value)) {
		if unicode.Is(unicode.M, character) {
			continue
		}
		if replacement, found := lookalikeCharacters[character]; found {
			mapped.WriteString(replacement)
			continue
		}
		mapped.WriteRune(character)
	}
	letters := strings.Map(func(character rune) rune {
		if character >= 'a' && character <= 'z' {
			return character
		}
		return -1
	}, mapped.String())
	letters = strings.ReplaceAll(strings.ReplaceAll(letters, "rn", "m"), "vv", "w")
	return collapseRepeatedLetters(letters)
}

func collapseRepeatedLetters(value string) string {
	var collapsed strings.Builder
	var previous rune
	for _, character := range value {
		if character != previous {
			collapsed.WriteRune(character)
		}
		previous = character
	}
	return collapsed.String()
}

func FindMatchingReservedRule(username string, rules []ReservedRule) (ReservedRule, bool) {
	skeleton := BuildConfusableSkeleton(username)
	if skeleton == "" {
		return ReservedRule{}, false
	}
	for _, rule := range rules {
		term := BuildConfusableSkeleton(rule.Term)
		if term != "" && skeletonMatchesRule(skeleton, term, rule.Kind) {
			return rule, true
		}
	}
	return ReservedRule{}, false
}

func skeletonMatchesRule(skeleton, term string, kind MatchKind) bool {
	switch kind {
	case MatchExact:
		return skeleton == term
	case MatchPrefix:
		return strings.HasPrefix(skeleton, term)
	case MatchContains:
		return strings.Contains(skeleton, term)
	}
	if skeleton == term {
		return true
	}
	for _, affix := range brandImpersonationAffixes {
		affixSkeleton := BuildConfusableSkeleton(affix)
		if skeleton == term+affixSkeleton || skeleton == affixSkeleton+term {
			return true
		}
	}
	return false
}

func BuildBaseFromSeed(seed string) string {
	local := strings.SplitN(strings.ToLower(seed), "@", 2)[0]
	var base strings.Builder
	for _, character := range norm.NFKD.String(local) {
		if (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') {
			base.WriteRune(character)
		}
	}
	result := base.String()
	if len(result) > 20 {
		result = result[:20]
	}
	return result
}

func GenerateCandidates(seeds []string, rules []ReservedRule) []string {
	base := "user"
	for _, seed := range seeds {
		candidate := BuildBaseFromSeed(seed)
		if _, reserved := FindMatchingReservedRule(candidate, rules); len(candidate) >= MinimumLength && HasValidFormat(candidate) && !reserved {
			base = candidate
			break
		}
	}
	candidates := make([]string, 0, 10)
	for _, digits := range []int{3, 3, 3, 3, 4, 4, 4, 6, 6, 8} {
		candidates = append(candidates, base+randomDigits(digits))
	}
	return append(candidates, "user"+hex.EncodeToString(randomBytes(6)))
}

func randomDigits(count int) string {
	var digits strings.Builder
	for range count {
		value, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			value = big.NewInt(7)
		}
		digits.WriteByte(byte('0' + value.Int64()))
	}
	return digits.String()
}

func randomBytes(count int) []byte {
	buffer := make([]byte, count)
	_, _ = rand.Read(buffer)
	return buffer
}
