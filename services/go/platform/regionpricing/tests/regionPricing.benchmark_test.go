package regionpricing_test

import (
	. "nantty/platform/regionpricing"
	"testing"
	"time"
)

func TestSuggestInternationalPriceUsesProvenanceAndDoesNotAutoApprove(t *testing.T) {
	retrieved := time.Date(2026, 10, 29, 0, 0, 0, 0, time.FixedZone("UTC+1", 3600))
	suggestion, err := SuggestInternationalPrice(InternationalBenchmark{
		CountryCode: "gb", Currency: "GBP", ReferenceTier: "X Premium", ReferenceMinor: 1_999,
		SourceURL: "https://help.x.com/en/using-x/x-premium", RetrievedAt: retrieved,
		BenchmarkVersion: "x-regional-2026-10", MultiplierBps: DefaultBenchmarkMultiplierBps,
	})
	if err != nil || suggestion.SuggestedMinor <= 0 || suggestion.Approved || suggestion.MultiplierBps != 7_500 || suggestion.RetrievedAt.Location() != time.UTC {
		t.Fatalf("unapproved benchmark suggestion with provenance: %+v, %v", suggestion, err)
	}
}

func TestSuggestInternationalPriceKeepsFounderNigeriaPricesOutOfBenchmark(t *testing.T) {
	_, err := SuggestInternationalPrice(InternationalBenchmark{
		CountryCode: "NG", Currency: "NGN", ReferenceTier: "X Premium", ReferenceMinor: 999_00,
		SourceURL: "https://help.x.com/en/using-x/x-premium", RetrievedAt: time.Now(),
		BenchmarkVersion: "test", MultiplierBps: AlternateBenchmarkMultiplierBps,
	})
	if err == nil {
		t.Fatal("Nigeria prices are explicit founder overrides and must not use benchmark calculations")
	}
}

func TestSuggestInternationalPriceRejectsUnverifiedSourceAndOverflow(t *testing.T) {
	base := InternationalBenchmark{CountryCode: "US", Currency: "USD", ReferenceTier: "X Premium", ReferenceMinor: 599, SourceURL: "https://help.x.com/en/using-x/x-premium", RetrievedAt: time.Now(), BenchmarkVersion: "test", MultiplierBps: 7_500}
	badSource := base
	badSource.SourceURL = "https://example.com/prices"
	if _, err := SuggestInternationalPrice(badSource); err == nil {
		t.Fatal("benchmark source must be an official X help page")
	}
	overflow := base
	overflow.ReferenceMinor = int64(^uint64(0) >> 1)
	overflow.MultiplierBps = 10_000
	if _, err := SuggestInternationalPrice(overflow); err == nil {
		t.Fatal("overflow must be rejected")
	}
}
