package commerceports

import "testing"

func TestOnlyActiveStoresCanSell(t *testing.T) {
	cases := map[string]bool{"active": true, "": true, "suspended": false, "closed": false, "pending": false}
	for status, expected := range cases {
		if got := (StoreAccess{StoreStatus: status}).CanSell(); got != expected {
			t.Errorf("status %q: CanSell() = %v, want %v", status, got, expected)
		}
	}
}
