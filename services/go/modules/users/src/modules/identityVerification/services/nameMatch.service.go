package services

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	NameMatchAutoApproveThreshold = 0.88
	NameMismatchFraudThreshold    = 0.5
	tokenMatchFloor               = 0.84
)

// ScoreNameMatch compares the name on the ID with the names the person uses on Zudomart. Every profile name token is
// matched to its closest ID token (Jaro-Winkler), so word order and extra middle names on the ID do not hurt, while a
// one-word display name can never score high enough to auto-approve on its own.
func ScoreNameMatch(documentName string, profileNames ...string) float64 {
	documentTokens := normalizeNameTokens(documentName)
	if len(documentTokens) == 0 {
		return 0
	}
	best := 0.0
	for _, profileName := range profileNames {
		profileTokens := normalizeNameTokens(profileName)
		if len(profileTokens) == 0 {
			continue
		}
		total := 0.0
		for _, token := range profileTokens {
			closest := 0.0
			for _, candidate := range documentTokens {
				closest = max(closest, jaroWinklerSimilarity(token, candidate))
			}
			if closest >= tokenMatchFloor {
				total += closest
			}
		}
		best = max(best, total/float64(max(len(profileTokens), 2)))
	}
	return min(best, 1)
}

func normalizeNameTokens(name string) []string {
	stripped, _, _ := transform.String(transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC), name)
	fields := strings.FieldsFunc(strings.ToLower(stripped), func(r rune) bool { return !unicode.IsLetter(r) })
	tokens := make([]string, 0, len(fields))
	for _, field := range fields {
		if len([]rune(field)) > 1 {
			tokens = append(tokens, field)
		}
	}
	return tokens
}

func jaroWinklerSimilarity(left, right string) float64 {
	a, b := []rune(left), []rune(right)
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	window := max(max(len(a), len(b))/2-1, 0)
	matchedA, matchedB := make([]bool, len(a)), make([]bool, len(b))
	matches := 0
	for i := range a {
		for j := max(0, i-window); j < min(len(b), i+window+1); j++ {
			if !matchedB[j] && a[i] == b[j] {
				matchedA[i], matchedB[j] = true, true
				matches++
				break
			}
		}
	}
	if matches == 0 {
		return 0
	}
	transpositions, k := 0, 0
	for i := range a {
		if !matchedA[i] {
			continue
		}
		for !matchedB[k] {
			k++
		}
		if a[i] != b[k] {
			transpositions++
		}
		k++
	}
	m := float64(matches)
	jaro := (m/float64(len(a)) + m/float64(len(b)) + (m-float64(transpositions)/2)/m) / 3
	prefix := 0
	for prefix < min(4, len(a), len(b)) && a[prefix] == b[prefix] {
		prefix++
	}
	return jaro + float64(prefix)*0.1*(1-jaro)
}
