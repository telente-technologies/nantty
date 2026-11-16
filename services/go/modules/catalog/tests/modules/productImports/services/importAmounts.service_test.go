package services_test

import (
	"testing"

	"nantty/modules/catalog/src/modules/productImports/services"
)

func TestMajorAmountsAreParsedServerSideInTheStoreCurrency(t *testing.T) {
	cases := map[string]int64{"1500": 150_000, "1,500.5": 150_050, "0.99": 99, "12.3": 1_230}
	for text, want := range cases {
		if got, err := services.ParseMajorAmountToMinor(text, "NGN"); err != nil || got != want {
			t.Errorf("%s: got %d %v, want %d", text, got, err, want)
		}
	}
	for _, bad := range []string{"", "-5", "1.234", "ten", "1e5", "₦500"} {
		if _, err := services.ParseMajorAmountToMinor(bad, "NGN"); err == nil {
			t.Errorf("%q must be rejected", bad)
		}
	}
	if !services.ParseYesNo("Yes") || services.ParseYesNo("no") {
		t.Fatal("yes/no parsing")
	}
	if _, ok := services.ParseOptionalWholeNumber("-1", 0, 10); ok {
		t.Fatal("negative counts are rejected")
	}
}
