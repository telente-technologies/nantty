package utils

import (
	"sort"
	"strings"
	"unicode"
)

const NameMatchThreshold = 0.85

func normalizedNameTokens(name string) []string {
	cleaned := strings.Map(func(character rune) rune {
		if unicode.IsLetter(character) {
			return unicode.ToLower(character)
		}
		return ' '
	}, name)
	tokens := strings.Fields(cleaned)
	sort.Strings(tokens)
	return tokens
}

func NamesMatch(left, right string) bool {
	return NameSimilarity(left, right) >= NameMatchThreshold
}

func NameSimilarity(left, right string) float64 {
	leftTokens, rightTokens := normalizedNameTokens(left), normalizedNameTokens(right)
	if len(leftTokens) == 0 || len(rightTokens) == 0 {
		return 0
	}
	shorter, longer := leftTokens, rightTokens
	if len(shorter) > len(longer) {
		shorter, longer = longer, shorter
	}
	total := 0.0
	used := make([]bool, len(longer))
	for _, token := range shorter {
		best, bestIndex := 0.0, -1
		for index, candidate := range longer {
			if used[index] {
				continue
			}
			if score := JaroWinkler(token, candidate); score > best {
				best, bestIndex = score, index
			}
		}
		if bestIndex >= 0 {
			used[bestIndex] = true
		}
		total += best
	}
	matched := total / float64(len(shorter))
	if len(shorter) < 2 && len(longer) >= 2 {
		matched *= 0.9
	}
	return matched
}

func JaroWinkler(left, right string) float64 {
	if left == right {
		return 1
	}
	leftRunes, rightRunes := []rune(left), []rune(right)
	if len(leftRunes) == 0 || len(rightRunes) == 0 {
		return 0
	}
	window := max(max(len(leftRunes), len(rightRunes))/2-1, 0)
	leftMatched, rightMatched := make([]bool, len(leftRunes)), make([]bool, len(rightRunes))
	matches := 0
	for index, character := range leftRunes {
		for other := max(0, index-window); other < min(len(rightRunes), index+window+1); other++ {
			if !rightMatched[other] && rightRunes[other] == character {
				leftMatched[index], rightMatched[other] = true, true
				matches++
				break
			}
		}
	}
	if matches == 0 {
		return 0
	}
	transpositions, other := 0, 0
	for index, matched := range leftMatched {
		if !matched {
			continue
		}
		for !rightMatched[other] {
			other++
		}
		if leftRunes[index] != rightRunes[other] {
			transpositions++
		}
		other++
	}
	count := float64(matches)
	jaro := (count/float64(len(leftRunes)) + count/float64(len(rightRunes)) + (count-float64(transpositions)/2)/count) / 3
	prefix := 0
	for prefix < min(4, len(leftRunes), len(rightRunes)) && leftRunes[prefix] == rightRunes[prefix] {
		prefix++
	}
	return jaro + float64(prefix)*0.1*(1-jaro)
}
