package services

import (
	"regexp"
	"strings"
)

var (
	phonePattern            = regexp.MustCompile(`^\+[1-9]\d{7,14}$`)
	phoneSeparators         = strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "")
	genericPostalPattern    = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9 -]{1,10}$`)
	postalPatternsByCountry = map[string]*regexp.Regexp{
		"GB": regexp.MustCompile(`^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$`),
		"US": regexp.MustCompile(`^\d{5}(-\d{4})?$`),
		"DE": regexp.MustCompile(`^\d{5}$`),
		"FR": regexp.MustCompile(`^\d{5}$`),
		"ES": regexp.MustCompile(`^\d{5}$`),
		"IT": regexp.MustCompile(`^\d{5}$`),
		"NL": regexp.MustCompile(`^\d{4} ?[A-Za-z]{2}$`),
		"ZA": regexp.MustCompile(`^\d{4}$`),
		"IE": regexp.MustCompile(`^[A-Za-z]\d{2} ?[A-Za-z\d]{4}$`),
		"NG": regexp.MustCompile(`^\d{6}$`),
		"KE": regexp.MustCompile(`^\d{5}$`),
		"GH": regexp.MustCompile(`^[A-Za-z]{2}-?\d{3}-?\d{4}$`),
	}
)

func NormalizePhoneToE164(raw string) (string, bool) {
	compact := phoneSeparators.Replace(strings.TrimSpace(raw))
	return compact, phonePattern.MatchString(compact)
}

func ValidatePostalCodeForCountry(countryCode, postalCode string, required bool) bool {
	trimmed := strings.TrimSpace(postalCode)
	if trimmed == "" {
		return !required
	}
	if pattern, found := postalPatternsByCountry[countryCode]; found {
		return pattern.MatchString(trimmed)
	}
	return genericPostalPattern.MatchString(trimmed)
}
