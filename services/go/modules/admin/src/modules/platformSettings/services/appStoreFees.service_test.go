package services

import (
	"encoding/json"
	"testing"
)

func TestAppStoreFeesSettingValidatesBasisPoints(t *testing.T) {
	definition := PlatformSettingDefinitions[AppStoreFeesKey]
	if _, err := definition.Validate(json.RawMessage(`{"appleFeeBps":3000,"appleSmallBusinessProgram":true,"appleSmallBusinessFeeBps":1500,"googleSubscriptionFeeBps":1500}`)); err != nil {
		t.Fatalf("valid store fees refused: %v", err)
	}
	for _, raw := range []string{`{"appleFeeBps":6000,"appleSmallBusinessFeeBps":1500,"googleSubscriptionFeeBps":1500}`, `{"googleSubscriptionFeeBps":-1}`, `{"unknown":1}`} {
		if _, err := definition.Validate(json.RawMessage(raw)); err == nil {
			t.Fatalf("%s must be refused", raw)
		}
	}
	if raw, _ := json.Marshal(definition.DefaultValue); string(raw) != `{"appleFeeBps":3000,"appleSmallBusinessProgram":false,"appleSmallBusinessFeeBps":1500,"googleSubscriptionFeeBps":1500}` {
		t.Fatalf("default %s", raw)
	}
}
