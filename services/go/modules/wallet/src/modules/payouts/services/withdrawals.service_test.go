package services

import (
	"math"
	"testing"
)

func TestWithdrawalFitsAvailableBalance(t *testing.T) {
	cases := []struct {
		name      string
		available int64
		reserved  int64
		amount    int64
		want      bool
	}{
		{"within balance", 1_000, 200, 800, true},
		{"reservation exceeds balance", 100, 101, 1, false},
		{"amount exceeds remaining balance", 100, 40, 61, false},
		{"exact remaining balance", 100, 40, 60, true},
		{"negative balance", -1, 0, 1, false},
		{"negative reservation", 100, -1, 1, false},
		{"nonpositive amount", 100, 0, 0, false},
		{"extreme reservation", math.MaxInt64, math.MaxInt64, 1, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := withdrawalFitsAvailableBalance(testCase.available, testCase.reserved, testCase.amount); got != testCase.want {
				t.Fatalf("withdrawalFitsAvailableBalance(%d, %d, %d) = %t, want %t", testCase.available, testCase.reserved, testCase.amount, got, testCase.want)
			}
		})
	}
}
