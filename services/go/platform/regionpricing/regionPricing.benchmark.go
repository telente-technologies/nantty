package regionpricing

import (
	"errors"
	"math"
	"math/big"
	"net/url"
	"strings"
	"time"
)

const (
	DefaultBenchmarkMultiplierBps   int64 = 7_500
	AlternateBenchmarkMultiplierBps int64 = 7_000
)

var ErrInvalidBenchmark = errors.New("invalid international pricing benchmark")

type InternationalBenchmark struct {
	CountryCode      string    `json:"countryCode"`
	Currency         string    `json:"currency"`
	ReferenceTier    string    `json:"referenceTier"`
	ReferenceMinor   int64     `json:"referenceMinor"`
	SourceURL        string    `json:"sourceUrl"`
	RetrievedAt      time.Time `json:"retrievedAt"`
	BenchmarkVersion string    `json:"benchmarkVersion"`
	MultiplierBps    int64     `json:"multiplierBps"`
}

type InternationalPriceSuggestion struct {
	CountryCode      string    `json:"countryCode"`
	Currency         string    `json:"currency"`
	ReferenceTier    string    `json:"referenceTier"`
	ReferenceMinor   int64     `json:"referenceMinor"`
	SuggestedMinor   int64     `json:"suggestedMinor"`
	SourceURL        string    `json:"sourceUrl"`
	RetrievedAt      time.Time `json:"retrievedAt"`
	BenchmarkVersion string    `json:"benchmarkVersion"`
	MultiplierBps    int64     `json:"multiplierBps"`
	Approved         bool      `json:"approved"`
}

// SuggestInternationalPrice returns an unpublished suggestion in the reference
// currency. It never performs FX conversion and deliberately rejects Nigeria,
// where explicit founder-set prices take precedence over the benchmark.
func SuggestInternationalPrice(input InternationalBenchmark) (InternationalPriceSuggestion, error) {
	country := strings.ToUpper(strings.TrimSpace(input.CountryCode))
	currency := strings.ToUpper(strings.TrimSpace(input.Currency))
	if country == "" || country == "NG" || len(currency) != 3 || input.ReferenceMinor <= 0 ||
		input.ReferenceTier == "" || input.BenchmarkVersion == "" || input.RetrievedAt.IsZero() ||
		input.MultiplierBps <= 0 || input.MultiplierBps > 10_000 {
		return InternationalPriceSuggestion{}, ErrInvalidBenchmark
	}
	source, err := url.Parse(input.SourceURL)
	if err != nil || source.Scheme != "https" || (source.Hostname() != "help.x.com" && source.Hostname() != "x.com") {
		return InternationalPriceSuggestion{}, ErrInvalidBenchmark
	}
	numerator := new(big.Int).Mul(big.NewInt(input.ReferenceMinor), big.NewInt(input.MultiplierBps))
	numerator.Add(numerator, big.NewInt(5_000))
	numerator.Div(numerator, big.NewInt(10_000))
	if !numerator.IsInt64() {
		return InternationalPriceSuggestion{}, ErrInvalidBenchmark
	}
	unrounded := numerator.Int64()
	if unrounded > math.MaxInt64-100_000 {
		return InternationalPriceSuggestion{}, ErrInvalidBenchmark
	}
	minor := RoundToPricePoint(unrounded, currency)
	if minor <= 0 {
		return InternationalPriceSuggestion{}, ErrInvalidBenchmark
	}
	return InternationalPriceSuggestion{
		CountryCode: country, Currency: currency, ReferenceTier: input.ReferenceTier,
		ReferenceMinor: input.ReferenceMinor, SuggestedMinor: minor, SourceURL: input.SourceURL,
		RetrievedAt: input.RetrievedAt.UTC(), BenchmarkVersion: input.BenchmarkVersion,
		MultiplierBps: input.MultiplierBps, Approved: false,
	}, nil
}
