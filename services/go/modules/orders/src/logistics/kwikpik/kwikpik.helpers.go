package kwikpik

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"nantty/modules/orders/src/logistics"
)

func (provider *Provider) buildUnifiedOrder(request logistics.BookRequest) map[string]any {
	order := map[string]any{
		"merchantPackageNumber": request.Reference,
		"pickupAddress":         formatAddress(request.Pickup, 300),
		"pickupContactName":     truncateRunes(request.Pickup.RecipientName, 100),
		"pickupContactPhone":    strings.TrimSpace(request.Pickup.Phone),
		"pickupContactEmail":    provider.contactEmail,
		"deliveryAddress":       formatAddress(request.Destination, 300),
		"deliveryContactName":   truncateRunes(request.Destination.RecipientName, 100),
		"deliveryContactPhone":  strings.TrimSpace(request.Destination.Phone),
		"packageWeightInKg":     gramsToKg(request.Parcel.WeightGrams),
		"quantity":              max(request.Parcel.PackageCount, 1),
		"packageValue":          minorToMajor(request.Parcel.DeclaredValueMinor),
		"metadata":              map[string]any{"storeId": request.StoreId.String(), "orderGroupId": request.OrderGroupId.String()},
	}
	if request.Pickup.Latitude != nil {
		order["pickupLatitude"] = *request.Pickup.Latitude
	}
	if request.Pickup.Longitude != nil {
		order["pickupLongitude"] = *request.Pickup.Longitude
	}
	if notes := firstNonEmpty(request.Pickup.Instructions, request.Notes); notes != "" {
		order["pickupNotes"] = notes
	}
	if request.Destination.Latitude != nil {
		order["deliveryLatitude"] = *request.Destination.Latitude
	}
	if request.Destination.Longitude != nil {
		order["deliveryLongitude"] = *request.Destination.Longitude
	}
	if notes := firstNonEmpty(request.Destination.Instructions, request.Notes); notes != "" {
		order["deliveryNotes"] = notes
	}
	if desc := truncateRunes(request.Parcel.ContentsDescription, 50); desc != "" {
		order["description"] = desc
	}
	if request.ScheduledPickupAt != nil {
		order["scheduledPickupTime"] = request.ScheduledPickupAt.UTC().Format(time.RFC3339)
	}
	if vehicle := normalizeVehicleType(request.Quote.VehicleType); vehicle != "" {
		order["vehicleType"] = vehicle
	}
	return order
}

func defaultPaths() Paths {
	return Paths{
		EstimateOrder:     "/orders/estimate",
		BulkOrdersUnified: "/orders/bulk/unified",
		TrackPackage:      "/packages/%s/track",
		CancelOrder:       "/orders/%s/cancel",
		Locations:         "/locations",
		ShippingLabel:     "/packages/%s/label",
	}
}

func mergePaths(custom Paths) Paths {
	defaults := defaultPaths()
	return Paths{
		EstimateOrder:     firstNonEmpty(custom.EstimateOrder, defaults.EstimateOrder),
		BulkOrdersUnified: firstNonEmpty(custom.BulkOrdersUnified, defaults.BulkOrdersUnified),
		TrackPackage:      firstNonEmpty(custom.TrackPackage, defaults.TrackPackage),
		CancelOrder:       firstNonEmpty(custom.CancelOrder, defaults.CancelOrder),
		Locations:         firstNonEmpty(custom.Locations, defaults.Locations),
		ShippingLabel:     firstNonEmpty(custom.ShippingLabel, defaults.ShippingLabel),
	}
}

func (provider *Provider) doJSON(ctx context.Context, method, path string, body any, out any) error {
	var bodyReader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, provider.baseUrl+path, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", provider.apiKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := provider.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("kwikpik api error: status %d", resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out)
}

type decimalAmount struct {
	raw string
}

func (amount *decimalAmount) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		amount.raw = ""
		return nil
	}
	if strings.HasPrefix(trimmed, `"`) && strings.HasSuffix(trimmed, `"`) {
		var str string
		if err := json.Unmarshal(data, &str); err != nil {
			return err
		}
		amount.raw = strings.TrimSpace(str)
		return nil
	}
	amount.raw = trimmed
	return nil
}

func (amount decimalAmount) toMinor() (int64, error) {
	if amount.raw == "" {
		return 0, nil
	}
	parsed, err := strconv.ParseFloat(amount.raw, 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return 0, fmt.Errorf("invalid decimal amount %q", amount.raw)
	}
	return int64(math.Round(parsed * 100)), nil
}

func formatAddress(addr logistics.Address, maxRunes int) string {
	parts := []string{}
	for _, part := range []string{addr.Line1, addr.Line2, addr.City, addr.Region, addr.PostalCode, addr.CountryCode} {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return truncateRunes(strings.Join(parts, ", "), maxRunes)
}

func truncateRunes(value string, limit int) string {
	trimmed := strings.TrimSpace(value)
	if limit <= 0 || utf8.RuneCountInString(trimmed) <= limit {
		return trimmed
	}
	runes := []rune(trimmed)
	return strings.TrimSpace(string(runes[:limit]))
}

func gramsToKg(grams int) float64 {
	if grams <= 0 {
		return 0
	}
	return math.Round((float64(grams)/1000.0)*1000) / 1000
}

func minorToMajor(minor int64) float64 {
	if minor <= 0 {
		return 0
	}
	return math.Round((float64(minor)/100.0)*100) / 100
}

func normalizeVehicleType(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "BIKE", "MOTORCYCLE", "CAR", "VAN", "TRUCK", "BICYCLE":
		return strings.ToUpper(strings.TrimSpace(raw))
	default:
		return ""
	}
}

func normalizeCountryCode(raw string) string {
	upper := strings.ToUpper(strings.TrimSpace(raw))
	switch upper {
	case "NIGERIA":
		return "NG"
	default:
		return upper
	}
}

func normalizeV2Status(status, statusCode string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "PENDING", "RECEIVED", "AWAITING_PICKUP", "BOOKED", "CONFIRMED":
		return logistics.StatusBooked
	case "PICKED_UP":
		return logistics.StatusPickedUp
	case "DISPATCHED_TO_LOCATION", "IN_TRANSIT_TO_LOCATION", "RECEIVED_AT_LOCATION", "IN_TRANSIT", "OUT_FOR_DELIVERY":
		return logistics.StatusInTransit
	case "DELIVERED", "COMPLETED":
		return logistics.StatusDelivered
	case "CANCELLED", "CANCELED":
		return logistics.StatusCancelled
	case "FAILED", "RETURN_INITIATED", "RETURN_IN_TRANSIT", "RETURNED_TO_LOCATION":
		return logistics.StatusFailed
	default:
		if strings.ToUpper(strings.TrimSpace(statusCode)) == "DELIVERED" {
			return logistics.StatusDelivered
		}
		return logistics.StatusBooked
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
