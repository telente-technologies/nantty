package logistics_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/partnerLogistics/controllers"
)

func TestPartnerBookingFailsClosedBeforeCarrierCall(t *testing.T) {
	controller := controllers.PartnerLogisticsController{Container: &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	recorder := httptest.NewRecorder()
	controller.Book(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/seller/delivery/partner/book", nil))
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "PARTNER_BOOKING_UNAVAILABLE") {
		t.Fatalf("expected unavailable response, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
