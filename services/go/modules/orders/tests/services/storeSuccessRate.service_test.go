package services_test

import (
	"testing"

	"nantty/modules/orders/src/services"
)

func TestCalculateSuccessRateThreshold(t *testing.T) {
	if services.CalculateSuccessRate(19, 19) != nil {
		t.Fatal("fewer than 20 orders must not show a rate")
	}
	rate := services.CalculateSuccessRate(20, 19)
	if rate == nil || *rate != 0.95 {
		t.Fatalf("got %v", rate)
	}
}

func TestCalculateSuccessRateRounding(t *testing.T) {
	rate := services.CalculateSuccessRate(30, 29)
	if rate == nil || *rate != 0.967 {
		t.Fatalf("got %v", rate)
	}
	if services.CalculateSuccessRate(25, 26) != nil || services.CalculateSuccessRate(25, -1) != nil {
		t.Fatal("inconsistent counts must yield nil")
	}
	if full := services.CalculateSuccessRate(40, 40); full == nil || *full != 1 {
		t.Fatalf("got %v", full)
	}
}
