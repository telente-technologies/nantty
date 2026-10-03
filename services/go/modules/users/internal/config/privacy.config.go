package config

import platformconfig "zudomart/platform/config"

type PrivacySettings struct{}

func ReadPrivacySettingsFromEnvironment(*platformconfig.EnvironmentReader) PrivacySettings {
	return PrivacySettings{}
}
