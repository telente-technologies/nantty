package services

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/logistics"
	"nantty/modules/orders/src/logistics/kwikpik"
	"nantty/modules/orders/src/modules/partnerLogistics/store"
	"nantty/platform/httpserver"
)

type QuoteInput struct {
	OrderGroupId *uuid.UUID        `json:"orderGroupId,omitempty"`
	Pickup       logistics.Address `json:"pickup"`
	Destination  logistics.Address `json:"destination"`
	Parcel       logistics.Parcel  `json:"parcel"`
	Currency     string            `json:"currency"`
	VehicleType  string            `json:"vehicleType,omitempty"`
}

type BookInput struct {
	QuoteId         uuid.UUID        `json:"quoteId"`
	OrderGroupId    uuid.UUID        `json:"orderGroupId"`
	Parcel          logistics.Parcel `json:"parcel"`
	DeliveryPin     string           `json:"deliveryPin,omitempty"`
	Notes           string           `json:"notes,omitempty"`
	ConsentAccepted bool             `json:"consentAccepted"`
}

type CancelInput struct {
	ProviderReference string `json:"providerReference"`
	Reason            string `json:"reason"`
}

type Service struct {
	Container *container.Container
	Store     store.PartnerLogisticsStore
}

func (service Service) requireKwikpik() (logistics.Provider, error) {
	provider, found := service.Container.Logistics.Provider(kwikpik.ProviderName)
	if !found {
		return nil, httpserver.NewApiError(http.StatusServiceUnavailable, "LOGISTICS_DISABLED", "Partner delivery is not enabled on this environment.")
	}
	return provider, nil
}

func (service Service) Quote(ctx context.Context, storeId uuid.UUID, input QuoteInput) (store.QuoteRecord, error) {
	provider, err := service.requireKwikpik()
	if err != nil {
		return store.QuoteRecord{}, err
	}
	if input.Parcel.WeightGrams <= 0 || input.Pickup.Line1 == "" || input.Destination.Line1 == "" {
		return store.QuoteRecord{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_LOGISTICS_REQUEST", "Pickup address, destination address, and positive weightGrams are required.")
	}
	parcel := input.Parcel
	currency := strings.ToUpper(strings.TrimSpace(input.Currency))
	if input.OrderGroupId != nil {
		order, found, orderErr := service.Store.FindOrderGroupForBooking(ctx, storeId, *input.OrderGroupId)
		if orderErr != nil {
			return store.QuoteRecord{}, orderErr
		}
		if !found {
			return store.QuoteRecord{}, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found for this store.")
		}
		if !isOrderEligibleForLogistics(order.Status) {
			return store.QuoteRecord{}, httpserver.NewApiError(http.StatusConflict, "ORDER_NOT_ELIGIBLE", "Cancelled, refunded, or completed orders cannot be quoted for partner delivery.")
		}
		if currency != "" && !strings.EqualFold(currency, order.Currency) {
			return store.QuoteRecord{}, httpserver.NewApiError(http.StatusBadRequest, "CURRENCY_MISMATCH", "Quote currency must match the order currency.")
		}
		currency = strings.ToUpper(order.Currency)
		parcel.DeclaredValueMinor = order.SubtotalMinor
		parcel.Currency = currency
	}
	quotes, err := provider.Quote(ctx, logistics.QuoteRequest{
		StoreId: storeId, OrderGroupId: input.OrderGroupId,
		Pickup: input.Pickup, Destination: input.Destination, Parcel: parcel,
		Currency: currency, VehicleType: input.VehicleType,
	})
	if err != nil || len(quotes) == 0 {
		return store.QuoteRecord{}, httpserver.NewApiError(http.StatusBadGateway, "LOGISTICS_QUOTE_FAILED", "Could not retrieve a live delivery quote.")
	}
	first := quotes[0]
	rec := store.QuoteRecord{
		Id: uuid.New(), StoreId: storeId, OrderGroupId: input.OrderGroupId,
		Provider: kwikpik.ProviderName, ProviderQuoteId: first.ProviderQuoteId, Status: "quoted",
		AmountMinor: first.AmountMinor, Currency: first.Currency, ExpiresAt: first.ExpiresAt,
		Pickup: input.Pickup, Destination: input.Destination,
	}
	if err := service.Store.SaveQuote(ctx, rec); err != nil {
		return store.QuoteRecord{}, err
	}
	return rec, nil
}

func (service Service) Book(ctx context.Context, storeId uuid.UUID, input BookInput) (store.ShipmentRecord, error) {
	provider, err := service.requireKwikpik()
	if err != nil {
		return store.ShipmentRecord{}, err
	}
	if input.Parcel.WeightGrams <= 0 {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_LOGISTICS_REQUEST", "Positive parcel weightGrams is required.")
	}
	order, orderFound, err := service.Store.FindOrderGroupForBooking(ctx, storeId, input.OrderGroupId)
	if err != nil {
		return store.ShipmentRecord{}, err
	}
	if !orderFound {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found for this store.")
	}
	if !isOrderEligibleForLogistics(order.Status) {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "ORDER_NOT_ELIGIBLE", "Order is not in a bookable fulfillment state.")
	}
	if !strings.EqualFold(order.PaymentStatus, "paid") {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "ORDER_PAYMENT_REQUIRED", "Order must be paid before booking partner delivery.")
	}
	alreadyBooked, err := service.Store.HasActiveShipmentForOrder(ctx, storeId, input.OrderGroupId)
	if err != nil {
		return store.ShipmentRecord{}, err
	}
	if alreadyBooked {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "SHIPMENT_ALREADY_BOOKED", "An active partner shipment already exists for this order.")
	}
	consented, err := service.Store.HasConsent(ctx, storeId)
	if err != nil {
		return store.ShipmentRecord{}, err
	}
	if !consented {
		if !input.ConsentAccepted {
			return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusPreconditionFailed, "LOGISTICS_CONSENT_REQUIRED", "Accept partner delivery data-sharing consent before booking.")
		}
		if err := service.Store.SaveConsent(ctx, storeId, true); err != nil {
			return store.ShipmentRecord{}, err
		}
	}
	quote, found, err := service.Store.FindQuote(ctx, storeId, input.QuoteId)
	if err != nil {
		return store.ShipmentRecord{}, err
	}
	if !found {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusNotFound, "QUOTE_NOT_FOUND", "Delivery quote was not found.")
	}
	if quote.Status != "quoted" {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "QUOTE_ALREADY_USED", "That delivery quote has already been booked or invalidated.")
	}
	if quote.OrderGroupId != nil && *quote.OrderGroupId != input.OrderGroupId {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "QUOTE_ORDER_MISMATCH", "That delivery quote belongs to a different order.")
	}
	if !strings.EqualFold(quote.Currency, order.Currency) {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "QUOTE_CURRENCY_MISMATCH", "Delivery quote currency does not match order currency.")
	}
	if quote.ExpiresAt.Before(time.Now().UTC()) {
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "QUOTE_EXPIRED", "That delivery quote has expired. Request a fresh quote.")
	}
	authoritativeParcel := input.Parcel
	authoritativeParcel.DeclaredValueMinor = order.SubtotalMinor
	authoritativeParcel.Currency = strings.ToUpper(order.Currency)
	rec := store.ShipmentRecord{
		Id: uuid.New(), OrderGroupId: input.OrderGroupId, StoreId: storeId,
		Provider: kwikpik.ProviderName, Status: "booking_pending",
	}
	if err := service.Store.ReserveShipment(ctx, rec, quote, authoritativeParcel); err != nil {
		if errors.Is(err, store.ErrQuoteAlreadyUsed) || errors.Is(err, store.ErrShipmentAlreadyReserved) {
			return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusConflict, "SHIPMENT_BOOKING_IN_PROGRESS", "Partner delivery is already reserved or being booked for this order.")
		}
		return store.ShipmentRecord{}, err
	}
	booking, err := provider.Book(ctx, logistics.BookRequest{
		StoreId: storeId, OrderGroupId: input.OrderGroupId, Reference: input.OrderGroupId.String(),
		Quote:  logistics.Quote{Provider: kwikpik.ProviderName, ProviderQuoteId: quote.ProviderQuoteId, AmountMinor: quote.AmountMinor, Currency: quote.Currency},
		Pickup: quote.Pickup, Destination: quote.Destination, Parcel: authoritativeParcel, DeliveryPin: input.DeliveryPin, Notes: input.Notes,
	})
	if err != nil {
		_ = service.Store.MarkShipmentBookingUnknown(ctx, storeId, rec.Id)
		_ = service.enqueueDomainEvent(ctx, "delivery.partnerBookingUncertain", rec.Id.String(), map[string]any{
			"shipmentId": rec.Id.String(), "storeId": storeId.String(), "orderGroupId": input.OrderGroupId.String(), "provider": kwikpik.ProviderName,
		})
		return store.ShipmentRecord{}, httpserver.NewApiError(http.StatusBadGateway, "LOGISTICS_BOOKING_UNCERTAIN", "Partner delivery status could not be confirmed. Do not book this order again until it is reconciled.")
	}
	now := time.Now().UTC()
	rec.ProviderReference = booking.ProviderReference
	rec.Status = booking.Status
	rec.TrackingNumber = booking.TrackingNumber
	rec.BookedAt = &now
	rec.EstimatedAt = booking.EstimatedDeliveryAt
	if err := service.Store.CompleteShipmentBooking(ctx, rec, quote.Id); err != nil {
		_ = service.Store.MarkShipmentBookingUnknown(ctx, storeId, rec.Id)
		return store.ShipmentRecord{}, err
	}
	_ = service.enqueueDomainEvent(ctx, "delivery.partnerBookingConfirmed", rec.Id.String(), map[string]any{
		"shipmentId": rec.Id.String(), "orderGroupId": rec.OrderGroupId.String(), "storeId": rec.StoreId.String(),
		"provider": rec.Provider, "trackingNumber": rec.TrackingNumber, "amountMinor": quote.AmountMinor, "currency": quote.Currency,
	})
	return rec, nil
}

func (service Service) Cancel(ctx context.Context, storeId uuid.UUID, input CancelInput) error {
	provider, err := service.requireKwikpik()
	if err != nil {
		return err
	}
	shipment, found, err := service.Store.FindShipmentByProviderReference(ctx, storeId, kwikpik.ProviderName, strings.TrimSpace(input.ProviderReference))
	if err != nil {
		return err
	}
	if !found {
		return httpserver.NewApiError(http.StatusNotFound, "SHIPMENT_NOT_FOUND", "Shipment was not found for this store.")
	}
	if shipment.Status == logistics.StatusCancelled || shipment.Status == logistics.StatusDelivered {
		return httpserver.NewApiError(http.StatusConflict, "SHIPMENT_NOT_CANCELLABLE", "Shipment can no longer be cancelled.")
	}
	if err := provider.Cancel(ctx, logistics.CancelRequest{ProviderReference: shipment.ProviderReference, Reason: input.Reason}); err != nil {
		return err
	}
	return service.Store.MarkShipmentCancelled(ctx, storeId, shipment.Id)
}

func (service Service) HandleWebhook(ctx context.Context, request *http.Request) error {
	provider, err := service.requireKwikpik()
	if err != nil {
		return err
	}
	ev, err := provider.ParseWebhook(request)
	if err != nil {
		return httpserver.NewApiError(http.StatusUnauthorized, "WEBHOOK_UNAUTHORIZED", "Invalid Kwikpik webhook signature.")
	}
	rec, applied, err := service.Store.RecordWebhookEvent(ctx, kwikpik.ProviderName, ev)
	if err != nil {
		return err
	}
	if !applied {
		return nil
	}
	canonical := mapStatusToCanonicalEvent(ev.Status)
	if canonical != "" {
		_ = service.enqueueDomainEvent(ctx, canonical, rec.Id.String(), map[string]any{
			"shipmentId": rec.Id.String(), "orderGroupId": rec.OrderGroupId.String(),
			"storeId": rec.StoreId.String(), "provider": rec.Provider, "status": rec.Status,
		})
	}
	return nil
}

func (service Service) enqueueDomainEvent(ctx context.Context, eventType, subject string, data map[string]any) error {
	if service.Container.Client == nil {
		return nil
	}
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, subject, time.Now().UTC(), data)
	})
}

func isOrderEligibleForLogistics(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "cancelled", "canceled", "completed", "refunded":
		return false
	default:
		return true
	}
}

func mapStatusToCanonicalEvent(status string) string {
	switch status {
	case logistics.StatusPickedUp:
		return "delivery.pickedUp"
	case logistics.StatusInTransit:
		return "delivery.inTransit"
	case logistics.StatusFailed:
		return "delivery.attemptFailed"
	case logistics.StatusDelivered:
		return "delivery.delivered"
	case logistics.StatusCancelled:
		return "delivery.cancelled"
	default:
		return ""
	}
}
