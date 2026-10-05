package types

import (
	"encoding/json"
	"testing"
)

func TestNullableSeparatesAbsentFromNull(t *testing.T) {
	var body struct {
		Cap Nullable[FrequencyCap] `json:"cap,omitzero"`
	}
	if err := json.Unmarshal([]byte(`{}`), &body); err != nil || body.Cap.Present {
		t.Fatalf("absent: %+v %v", body, err)
	}
	if err := json.Unmarshal([]byte(`{"cap":null}`), &body); err != nil || !body.Cap.Present || body.Cap.Value != nil {
		t.Fatalf("null: %+v %v", body, err)
	}
	if err := json.Unmarshal([]byte(`{"cap":{"impressions":2,"perDays":1}}`), &body); err != nil || body.Cap.Value.Impressions != 2 {
		t.Fatalf("value: %+v %v", body, err)
	}
	if err := json.Unmarshal([]byte(`{"cap":{"impressions":2,"unknown":1}}`), &body); err == nil {
		t.Fatal("unknown nested fields must be refused")
	}
	current := &FrequencyCap{Impressions: 5}
	if (Nullable[FrequencyCap]{}).Resolve(current) != current {
		t.Fatal("absent keeps the current value")
	}
}
