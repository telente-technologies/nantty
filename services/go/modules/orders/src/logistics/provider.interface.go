// Package logistics defines the provider-neutral delivery boundary. The
// package deliberately contains no routes and no provider implementation yet:
// seller-managed delivery remains the live flow until the logistics feature
// flag is explicitly enabled.
package logistics

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const (
	ServiceTypeDoorToDoor = "door_to_door"

	StatusQuoted    = "quoted"
	StatusBooked    = "booked"
	StatusPickedUp  = "picked_up"
	StatusInTransit = "in_transit"
	StatusDelivered = "delivered"
	StatusCancelled = "cancelled"
	StatusFailed    = "failed"
)

type FulfillmentMode string

const (
	FulfillmentSellerManaged   FulfillmentMode = "seller_managed"
	FulfillmentProviderManaged FulfillmentMode = "provider_managed"
)

type Address struct {
	RecipientName string
	Phone         string
	Line1         string
	Line2         string
	City          string
	Region        string
	CountryCode   string
	PostalCode    string
	Instructions  string
	Latitude      *float64
	Longitude     *float64
}

type Parcel struct {
	WeightGrams         int
	PackageCount        int
	ContentsDescription string
	DeclaredValueMinor  int64
	Currency            string
}

// PriceComponent preserves provider-returned line items so checkout can show
// a transparent total without inventing a tariff breakdown.
type PriceComponent struct {
	Code        string
	Label       string
	AmountMinor int64
	Currency    string
}

type QuoteRequest struct {
	StoreId      uuid.UUID
	CheckoutId   *uuid.UUID
	OrderGroupId *uuid.UUID
	Pickup       Address
	Destination  Address
	Parcel       Parcel
	Currency     string
	VehicleType  string
}

type Quote struct {
	Provider              string
	ProviderQuoteId       string
	ServiceType           string
	VehicleType           string
	DeliveryTimeline      string
	AmountMinor           int64
	InsurancePremiumMinor int64
	Currency              string
	ExpiresAt             time.Time
	Conditions            []string
	PriceComponents       []PriceComponent
	Metadata              map[string]any
}

type BookRequest struct {
	StoreId           uuid.UUID
	OrderGroupId      uuid.UUID
	Reference         string
	Quote             Quote
	Pickup            Address
	Destination       Address
	Parcel            Parcel
	DeliveryPin       string
	Notes             string
	ScheduledPickupAt *time.Time
}

type Booking struct {
	Provider            string
	ProviderReference   string
	Status              string
	TrackingNumber      string
	TrackingUrl         string
	EstimatedDeliveryAt *time.Time
	Metadata            map[string]any
}

type CancelRequest struct {
	ProviderReference string
	Reason            string
}

type TrackRequest struct {
	ProviderReference string
	TrackingNumber    string
}

type TrackingEvent struct {
	ProviderEventId string
	Status          string
	OccurredAt      time.Time
	Payload         map[string]any
}

type Tracking struct {
	ProviderReference string
	Status            string
	TrackingNumber    string
	TrackingUrl       string
	Events            []TrackingEvent
	Metadata          map[string]any
}

type Coverage struct {
	CountryCode string
	RegionName  string
	CityName    string
	DoorToDoor  bool
	Metadata    map[string]any
}

type WebhookEvent struct {
	ProviderEventId   string
	ProviderReference string
	Kind              string
	Status            string
	OccurredAt        time.Time
	Payload           map[string]any
}

type RedeliveryQuoteRequest struct {
	ProviderReference string
	Destination       Address
}

type RedeliveryRequest struct {
	ProviderReference string
	Quote             Quote
	DeliveryPin       string
	Notes             string
}

// Provider is the single booking path for one courier. An aggregator and the
// underlying courier must never both be wired for the same shipment.
type Provider interface {
	Name() string
	Quote(ctx context.Context, request QuoteRequest) ([]Quote, error)
	Book(ctx context.Context, request BookRequest) (Booking, error)
	Cancel(ctx context.Context, request CancelRequest) error
	Track(ctx context.Context, request TrackRequest) (Tracking, error)
	Coverage(ctx context.Context) ([]Coverage, error)
	ParseWebhook(request *http.Request) (WebhookEvent, error)
}

// RedeliveryProvider is optional because not every provider sells redelivery
// through its API.
type RedeliveryProvider interface {
	QuoteRedelivery(ctx context.Context, request RedeliveryQuoteRequest) (Quote, error)
	Redeliver(ctx context.Context, request RedeliveryRequest) (Booking, error)
}
