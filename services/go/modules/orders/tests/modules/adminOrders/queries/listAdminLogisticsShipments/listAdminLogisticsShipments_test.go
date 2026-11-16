package listadminlogistics_test

import (
	"testing"

	listadminlogistics "nantty/modules/orders/src/modules/adminOrders/queries/listAdminLogisticsShipments"
)

func TestShipmentStatusFilterAllowlist(t *testing.T) {
	for _, status := range []string{"pending", "quoted", "booked", "picked_up", "in_transit", "delivered", "cancelled", "failed"} {
		if !listadminlogistics.ValidShipmentStatus(status) {
			t.Errorf("expected status %q to be accepted", status)
		}
	}
	for _, status := range []string{"", "unknown", "FAILED", "open"} {
		if listadminlogistics.ValidShipmentStatus(status) {
			t.Errorf("expected status %q to be rejected", status)
		}
	}
}
