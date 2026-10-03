package services

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

type staticSettings struct {
	value json.RawMessage
	found bool
}

func (settings staticSettings) ReadValue(context.Context, string) (json.RawMessage, bool) {
	return settings.value, settings.found
}

func TestMonetizationRowsComeFromTheAdminSettingWithOnlyActiveRows(t *testing.T) {
	source := &PolicySource{Settings: staticSettings{found: true, value: json.RawMessage(`{"rows":[
		{"id":"original","label":"Original","multiplierBps":10000,"active":true},
		{"id":"ai_generated","label":"AI","multiplierBps":2500,"active":true},
		{"id":"remix","label":"Remix","multiplierBps":9000,"active":false}]}`)}}
	rows, err := source.MonetizationRows(context.Background())
	if err != nil || len(rows) != 2 {
		t.Fatalf("expected two active rows, got %v %v", rows, err)
	}
	share, multiplier := ResolveCreatorShare(rows, true, time.Now())
	if share != DefaultCreatorShareBps || multiplier != 2500 {
		t.Fatalf("admin multiplier must win over the built-in default, got %d/%d", share, multiplier)
	}
}

func TestMissingAdminSettingFallsBackToTheBuiltInThirtyPercentAiMultiplier(t *testing.T) {
	for name, source := range map[string]*PolicySource{"no reader": {}, "not found": {Settings: staticSettings{}}} {
		rows, _ := source.MonetizationRows(context.Background())
		if _, multiplier := ResolveCreatorShare(rows, true, time.Now()); multiplier != 3000 {
			t.Fatalf("%s: AI multiplier should default to 3000, got %d", name, multiplier)
		}
	}
}

func TestConfiguredCreatorShareAppliesToSettingRows(t *testing.T) {
	source := &PolicySource{ShareBps: 5000, Settings: staticSettings{found: true, value: json.RawMessage(`{"rows":[{"id":"original","multiplierBps":10000,"active":true}]}`)}}
	rows, _ := source.MonetizationRows(context.Background())
	if share, _ := ResolveCreatorShare(rows, false, time.Now()); share != 5000 {
		t.Fatalf("got share %d", share)
	}
}

func TestMalformedAdminSettingIsIgnoredRatherThanBreakingServing(t *testing.T) {
	source := &PolicySource{Settings: staticSettings{found: true, value: json.RawMessage(`not json`)}}
	rows, err := source.MonetizationRows(context.Background())
	if err != nil || len(rows) != 0 {
		t.Fatalf("got %v %v", rows, err)
	}
}
