package logistics

import (
	"context"
	"net/http"
	"testing"
)

type fakeProvider struct {
	name string
}

func (provider fakeProvider) Name() string { return provider.name }

func (fakeProvider) Quote(context.Context, QuoteRequest) ([]Quote, error) { return nil, nil }

func (fakeProvider) Book(context.Context, BookRequest) (Booking, error) { return Booking{}, nil }

func (fakeProvider) Cancel(context.Context, CancelRequest) error { return nil }

func (fakeProvider) Track(context.Context, TrackRequest) (Tracking, error) { return Tracking{}, nil }

func (fakeProvider) Coverage(context.Context) ([]Coverage, error) { return nil, nil }

func (fakeProvider) ParseWebhook(*http.Request) (WebhookEvent, error) { return WebhookEvent{}, nil }

func TestLogisticsRegistryIsHiddenWhenDisabled(t *testing.T) {
	registry := NewRegistry(false)
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
	registry := NewRegistry(true)
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
	if err := registry.Register(fakeProvider{name: "chowdeck"}); err != ErrProviderTaken {
		t.Fatalf("expected duplicate registration error, got %v", err)
	}
}
