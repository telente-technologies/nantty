package regionpricing

import (
	"encoding/json"
	"errors"
)

const StoreFeesSettingKey = "appStore.fees"

const maximumStoreFeeBps = 5_000

type StoreFeeSettings struct {
	AppleFeeBps               int64 `json:"appleFeeBps"`
	AppleSmallBusinessProgram bool  `json:"appleSmallBusinessProgram"`
	AppleSmallBusinessFeeBps  int64 `json:"appleSmallBusinessFeeBps"`
	GoogleSubscriptionFeeBps  int64 `json:"googleSubscriptionFeeBps"`
}

func DefaultStoreFeeSettings() StoreFeeSettings {
	return StoreFeeSettings{AppleFeeBps: 3_000, AppleSmallBusinessFeeBps: 1_500, GoogleSubscriptionFeeBps: 1_500}
}

func ValidateStoreFeeSettings(settings StoreFeeSettings) error {
	for _, bps := range []int64{settings.AppleFeeBps, settings.AppleSmallBusinessFeeBps, settings.GoogleSubscriptionFeeBps} {
		if bps < 0 || bps > maximumStoreFeeBps {
			return errors.New("store fees must be between 0 and 5000 basis points")
		}
	}
	return nil
}

func ParseStoreFeeSettings(raw json.RawMessage, found bool) StoreFeeSettings {
	defaults := DefaultStoreFeeSettings()
	if !found || len(raw) == 0 {
		return defaults
	}
	stored := defaults
	if json.Unmarshal(raw, &stored) != nil || ValidateStoreFeeSettings(stored) != nil {
		return defaults
	}
	return stored
}

func (settings StoreFeeSettings) FeeBpsForChannel(channel string) int64 {
	switch channel {
	case "ios":
		if settings.AppleSmallBusinessProgram {
			return settings.AppleSmallBusinessFeeBps
		}
		return settings.AppleFeeBps
	case "android":
		return settings.GoogleSubscriptionFeeBps
	}
	return 0
}
