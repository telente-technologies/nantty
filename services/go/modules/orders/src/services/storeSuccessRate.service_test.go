package services

import "testing"

func TestCalculateSuccessRateThreshold(t *testing.T) {
	if CalculateSuccessRate(19, 19) != nil {
		t.Fatal("fewer than 20 orders must not show a rate")
	}
	rate := CalculateSuccessRate(20, 19)
	if rate == nil || *rate != 0.95 {
		t.Fatalf("got %v", rate)
	}
}

func TestCalculateSuccessRateRounding(t *testing.T) {
	rate := CalculateSuccessRate(30, 29)
	if rate == nil || *rate != 0.967 {
		t.Fatalf("got %v", rate)
	}
	if CalculateSuccessRate(25, 26) != nil || CalculateSuccessRate(25, -1) != nil {
		t.Fatal("inconsistent counts must yield nil")
	}
	if full := CalculateSuccessRate(40, 40); full == nil || *full != 1 {
		t.Fatalf("got %v", full)
	}
}
