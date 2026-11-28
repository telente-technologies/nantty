package services_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"nantty/modules/ads/src/services"
)

type staticSettings struct {
	value json.RawMessage
	found bool
}

func (settings staticSettings) ReadValue(context.Context, string) (json.RawMessage, bool) {
	return settings.value, settings.found
}

func TestMonetizationRowsComeFromTheAdminSettingWithOnlyActiveRows(t *testing.T) {
	source := &services.PolicySource{Settings: staticSettings{found: true, value: json.RawMessage(`{"rows":[
		{"id":"original","label":"Original","multiplierBps":10000,"active":true},
		{"id":"ai_generated","label":"AI","multiplierBps":2500,"active":true},
		{"id":"remix","label":"Remix","multiplierBps":9000,"active":false}]}`)}}
	rows, err := source.MonetizationRows(context.Background())
	if err != nil || len(rows) != 2 {
		t.Fatalf("expected two active rows, got %v %v", rows, err)
	}
	share, multiplier := services.ResolveCreatorShare(rows, true, time.Now())
	if share != services.DefaultCreatorShareBps || multiplier != 2500 {
		t.Fatalf("admin multiplier must win over the built-in default, got %d/%d", share, multiplier)
	}
}

func TestMissingAdminSettingFallsBackToTheBuiltInThirtyPercentAiMultiplier(t *testing.T) {
	for name, source := range map[string]*services.PolicySource{"no reader": {}, "not found": {Settings: staticSettings{}}} {
		rows, _ := source.MonetizationRows(context.Background())
		if _, multiplier := services.ResolveCreatorShare(rows, true, time.Now()); multiplier != 3000 {
			t.Fatalf("%s: AI multiplier should default to 3000, got %d", name, multiplier)
		}
	}
}

func TestConfiguredCreatorShareAppliesToSettingRows(t *testing.T) {
	source := &services.PolicySource{ShareBps: 5000, Settings: staticSettings{found: true, value: json.RawMessage(`{"rows":[{"id":"original","multiplierBps":10000,"active":true}]}`)}}
	rows, _ := source.MonetizationRows(context.Background())
	if share, _ := services.ResolveCreatorShare(rows, false, time.Now()); share != 5000 {
		t.Fatalf("got share %d", share)
	}
}

func TestMalformedAdminSettingIsIgnoredRatherThanBreakingServing(t *testing.T) {
	source := &services.PolicySource{Settings: staticSettings{found: true, value: json.RawMessage(`not json`)}}
	rows, err := source.MonetizationRows(context.Background())
	if err != nil || len(rows) != 0 {
		t.Fatalf("got %v %v", rows, err)
	}
}

func TestInvalidActiveMultipliersAreIgnoredAndUseRuntimeDefaults(t *testing.T) {
	source := &services.PolicySource{Settings: staticSettings{found: true, value: json.RawMessage(`{"rows":[{"id":"ai_generated","multiplierBps":-1,"active":true}]}`)}}
	rows, err := source.MonetizationRows(context.Background())
	if err != nil || len(rows) != 0 {
		t.Fatalf("invalid policy must not be applied: %v %v", rows, err)
	}
	if _, multiplier := services.ResolveCreatorShare(rows, true, time.Now()); multiplier != services.DefaultAiMultiplierBps {
		t.Fatalf("invalid active multiplier must use runtime default, got %d", multiplier)
	}
}

type keyedSettings map[string]string

func (settings keyedSettings) ReadValue(_ context.Context, key string) (json.RawMessage, bool) {
	value, found := settings[key]
	return json.RawMessage(value), found
}

func TestCreatorAdShareFollowsTheAdminRevenueSetting(t *testing.T) {
	settings := keyedSettings{services.MonetizationSettingKey: `{"rows":[{"id":"original","multiplierBps":10000,"active":true}]}`}
	source := &services.PolicySource{ShareBps: 4000, Settings: settings}
	if share := source.CreatorShareBps(context.Background()); share != 4000 {
		t.Fatalf("a missing revenue setting must use the environment share, got %d", share)
	}
	settings[services.RevenueSettingKey] = `{"creatorAdShareBasisPoints":5500}`
	rows, _ := source.MonetizationRows(context.Background())
	if share, _ := services.ResolveCreatorShare(rows, false, time.Now()); share != 5500 {
		t.Fatalf("a changed revenue setting must take effect, got %d", share)
	}
	if share, _ := services.ResolveCreatorShareWithDefault(nil, true, time.Now(), source.CreatorShareBps(context.Background())); share != 5500 {
		t.Fatalf("content without a policy row must use the configured share, got %d", share)
	}
	settings[services.RevenueSettingKey] = `not json`
	if share := source.CreatorShareBps(context.Background()); share != 4000 {
		t.Fatalf("an unreadable revenue setting must use the environment share, got %d", share)
	}
}
