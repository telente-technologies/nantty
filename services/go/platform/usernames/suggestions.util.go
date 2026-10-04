package usernames

import "strconv"

const suggestionPoolSize = 14

func BuildSuggestionCandidates(seeds []string, rules []ReservedRule, year int) []string {
	bases := suggestionBases(seeds, rules)
	yearText := strconv.Itoa(year)
	builders := []func(base string) string{
		func(base string) string { return base + "_" + randomDigits(2) },
		func(base string) string { return base + randomDigits(2) },
		func(base string) string { return base + yearText },
		func(base string) string { return base + "." + randomDigits(2) },
		func(base string) string { return shortVariant(base) + randomDigits(3) },
		func(base string) string { return base + "_" + yearText[len(yearText)-2:] },
	}
	seen := map[string]struct{}{}
	pool := make([]string, 0, suggestionPoolSize)
	for _, build := range builders {
		for _, base := range bases {
			candidate := build(base)
			_, duplicate := seen[candidate]
			_, reserved := FindMatchingReservedRule(candidate, rules)
			if duplicate || reserved || !HasValidFormat(candidate) || len(pool) >= suggestionPoolSize {
				continue
			}
			seen[candidate] = struct{}{}
			pool = append(pool, candidate)
		}
	}
	for len(pool) < suggestionPoolSize {
		pool = append(pool, bases[0]+"_"+randomDigits(4))
	}
	return pool
}

func suggestionBases(seeds []string, rules []ReservedRule) []string {
	bases := make([]string, 0, 2)
	for _, seed := range seeds {
		base := BuildBaseFromSeed(seed)
		if len(base) < MinimumLength || !HasValidFormat(base) {
			continue
		}
		if _, reserved := FindMatchingReservedRule(base, rules); reserved {
			continue
		}
		if len(bases) == 0 || bases[0] != base {
			bases = append(bases, base)
		}
		if len(bases) == 2 {
			break
		}
	}
	if len(bases) == 0 {
		return []string{"user"}
	}
	return bases
}

func shortVariant(base string) string {
	if len(base) <= 8 {
		return base
	}
	return base[:6]
}
