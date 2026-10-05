package regionpricing

import "strings"

var appleStorefrontAlpha3ToCountry = map[string]string{
	"NGA": "NG", "GHA": "GH", "KEN": "KE", "ZAF": "ZA", "GBR": "GB", "USA": "US",
	"AUT": "AT", "BEL": "BE", "HRV": "HR", "CYP": "CY", "EST": "EE", "FIN": "FI", "FRA": "FR", "DEU": "DE", "GRC": "GR", "IRL": "IE",
	"ITA": "IT", "LVA": "LV", "LTU": "LT", "LUX": "LU", "MLT": "MT", "NLD": "NL", "PRT": "PT", "SVK": "SK", "SVN": "SI", "ESP": "ES",
}

func StorefrontCountry(raw string) (country string, known bool) {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if normalized := NormalizeCountryCode(code); normalized != "" {
		return normalized, true
	}
	if len(code) != 3 {
		return "", false
	}
	for _, character := range code {
		if character < 'A' || character > 'Z' {
			return "", false
		}
	}
	return appleStorefrontAlpha3ToCountry[code], true
}
