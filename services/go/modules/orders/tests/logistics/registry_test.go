package logistics_test

import (
	"context"
	"net/http"
	"testing"

	"nantty/modules/orders/src/logistics"
)

type fakeProvider struct {
	name string
}

func (provider fakeProvider) Name() string { return provider.name }

func (fakeProvider) Quote(context.Context, logistics.QuoteRequest) ([]logistics.Quote, error) {
	return nil, nil
}

func (fakeProvider) Book(context.Context, logistics.BookRequest) (logistics.Booking, error) {
	return logistics.Booking{}, nil
}

func (fakeProvider) Cancel(context.Context, logistics.CancelRequest) error { return nil }

func (fakeProvider) Track(context.Context, logistics.TrackRequest) (logistics.Tracking, error) {
	return logistics.Tracking{}, nil
}

func (fakeProvider) Coverage(context.Context) ([]logistics.Coverage, error) { return nil, nil }

func (fakeProvider) ParseWebhook(*http.Request) (logistics.WebhookEvent, error) {
	return logistics.WebhookEvent{}, nil
}

func TestLogisticsRegistryIsHiddenWhenDisabled(t *testing.T) {
	registry := logistics.NewRegistry(false)
	if err := registry.Register(fakeProvider{name: "chowdeck"}); err != nil {
		t.Fatalf("register provider: %v", err)
	}
	if registry.Enabled() {
		t.Fatal("disabled registry reports enabled")
	}
	if _, found := registry.Provider("chowdeck"); found {
		t.Fatal("disabled registry returned a provider")
	}
	if names := registry.Names(); names != nil {
		t.Fatalf("disabled registry returned names: %v", names)
	}
}

func TestLogisticsRegistryReturnsRegisteredProvidersWhenEnabled(t *testing.T) {
	registry := logistics.NewRegistry(true)
	if err := registry.Register(fakeProvider{name: "shipbubble"}); err != nil {
		t.Fatalf("register shipbubble: %v", err)
	}
	if err := registry.Register(fakeProvider{name: "chowdeck"}); err != nil {
		t.Fatalf("register chowdeck: %v", err)
	}
	if _, found := registry.Provider("chowdeck"); !found {
		t.Fatal("registered provider was not found")
	}
	names := registry.Names()
	if len(names) != 2 || names[0] != "chowdeck" || names[1] != "shipbubble" {
		t.Fatalf("unexpected provider names: %v", names)
	}
	if err := registry.Register(fakeProvider{name: "chowdeck"}); err != logistics.ErrProviderTaken {
		t.Fatalf("expected duplicate registration error, got %v", err)
	}
}
