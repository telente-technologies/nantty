package constants

import "embed"

//go:embed data/*.json
var GeoSeedFiles embed.FS

var SeedFileNames = []string{"data/nigeria.json", "data/other_countries.json"}

var CurrencyByCountryCode = map[string]string{
	"NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR", "GB": "GBP", "US": "USD",
	"DE": "EUR", "FR": "EUR", "IE": "EUR", "NL": "EUR", "ES": "EUR", "IT": "EUR",
}

const (
	LevelState = "state"
	LevelLga   = "lga"
	LevelCity  = "city"
)
