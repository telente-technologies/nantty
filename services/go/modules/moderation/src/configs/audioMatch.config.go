package configs

import (
	"time"

	platformconfig "nantty/platform/config"
)

type AudioMatchSettings struct {
	IntelligenceUrl    string
	IntelligenceSecret string
	Timeout            time.Duration
}

func readAudioMatchSettings(reader *platformconfig.EnvironmentReader) AudioMatchSettings {
	return AudioMatchSettings{
		IntelligenceUrl:    reader.ReadStringOrDefault("INTELLIGENCE_URL", ""),
		IntelligenceSecret: reader.ReadStringOrDefault("INTELLIGENCE_SHARED_SECRET", ""),
		Timeout:            time.Duration(reader.ReadIntegerOrDefault("MODERATION_AUDIO_MATCH_TIMEOUT_SECONDS", 90)) * time.Second,
	}
}
