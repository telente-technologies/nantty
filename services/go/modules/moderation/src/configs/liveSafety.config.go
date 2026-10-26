package configs

import (
	"strconv"
	"time"

	platformconfig "nantty/platform/config"
)

type LiveSafetySettings struct {
	ScoresQueue          string
	FramesBucket         string
	FramesRegion         string
	FramesEndpoint       string
	EvidenceBucket       string
	EvidenceKmsKeyId     string
	EvidencePrefix       string
	FramePreviewLifetime time.Duration
	HoldConfidence       float64
	RepeatHoldConfidence float64
	WarnConfidence       float64
	ReviewConfidence     float64
	ReportSurgeCount     int
	ReportSurgeWindow    time.Duration
	SamplingBoost        time.Duration
	WarningCooldown      time.Duration
	RepeatOffenderStrike int
}

func readLiveSafetySettings(reader *platformconfig.EnvironmentReader) LiveSafetySettings {
	return LiveSafetySettings{
		ScoresQueue:          reader.ReadStringOrDefault("INTELLIGENCE_TRUST_LIVE_SAFETY_QUEUE", "intelligence-trust-live-safety"),
		FramesBucket:         reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_BUCKET", ""),
		FramesRegion:         reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_REGION", "us-east-1"),
		FramesEndpoint:       reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_ENDPOINT", ""),
		EvidenceBucket:       reader.ReadStringOrDefault("LIVE_SAFETY_EVIDENCE_S3_BUCKET", ""),
		EvidenceKmsKeyId:     reader.ReadStringOrDefault("LIVE_SAFETY_EVIDENCE_KMS_KEY_ID", ""),
		EvidencePrefix:       reader.ReadStringOrDefault("LIVE_SAFETY_EVIDENCE_PREFIX", "trust-evidence/live/"),
		FramePreviewLifetime: reader.ReadDurationOrDefault("LIVE_SAFETY_FRAME_PREVIEW_TTL", 5*time.Minute),
		HoldConfidence:       readFraction(reader, "LIVE_SAFETY_HOLD_CONFIDENCE", 0.90),
		RepeatHoldConfidence: readFraction(reader, "LIVE_SAFETY_REPEAT_OFFENDER_HOLD_CONFIDENCE", 0.80),
		WarnConfidence:       readFraction(reader, "LIVE_SAFETY_WARN_CONFIDENCE", 0.70),
		ReviewConfidence:     readFraction(reader, "LIVE_SAFETY_REVIEW_CONFIDENCE", 0.50),
		ReportSurgeCount:     reader.ReadIntegerOrDefault("LIVE_SAFETY_REPORT_SURGE_COUNT", 5),
		ReportSurgeWindow:    reader.ReadDurationOrDefault("LIVE_SAFETY_REPORT_SURGE_WINDOW", 3*time.Minute),
		SamplingBoost:        reader.ReadDurationOrDefault("LIVE_SAFETY_SAMPLING_BOOST", 10*time.Minute),
		WarningCooldown:      reader.ReadDurationOrDefault("LIVE_SAFETY_WARNING_COOLDOWN", 2*time.Minute),
		RepeatOffenderStrike: reader.ReadIntegerOrDefault("LIVE_SAFETY_REPEAT_OFFENDER_STRIKES", 2),
	}
}

func DefaultLiveSafetySettings() LiveSafetySettings {
	return LiveSafetySettings{
		ScoresQueue: "intelligence-trust-live-safety", EvidencePrefix: "trust-evidence/live/", FramePreviewLifetime: 5 * time.Minute,
		HoldConfidence: 0.90, RepeatHoldConfidence: 0.80, WarnConfidence: 0.70, ReviewConfidence: 0.50,
		ReportSurgeCount: 5, ReportSurgeWindow: 3 * time.Minute, SamplingBoost: 10 * time.Minute, WarningCooldown: 2 * time.Minute, RepeatOffenderStrike: 2,
	}
}

func readFraction(reader *platformconfig.EnvironmentReader, name string, fallback float64) float64 {
	parsed, err := strconv.ParseFloat(reader.ReadStringOrDefault(name, strconv.FormatFloat(fallback, 'f', -1, 64)), 64)
	if err != nil || parsed <= 0 || parsed > 1 {
		return fallback
	}
	return parsed
}

func (settings LiveSafetySettings) WithDefaults() LiveSafetySettings {
	defaults := DefaultLiveSafetySettings()
	if settings.ScoresQueue == "" {
		settings.ScoresQueue = defaults.ScoresQueue
	}
	if settings.EvidencePrefix == "" {
		settings.EvidencePrefix = defaults.EvidencePrefix
	}
	if settings.FramePreviewLifetime <= 0 {
		settings.FramePreviewLifetime = defaults.FramePreviewLifetime
	}
	if settings.HoldConfidence == 0 {
		settings.HoldConfidence, settings.RepeatHoldConfidence, settings.WarnConfidence, settings.ReviewConfidence = defaults.HoldConfidence, defaults.RepeatHoldConfidence, defaults.WarnConfidence, defaults.ReviewConfidence
	}
	if settings.ReportSurgeCount <= 0 {
		settings.ReportSurgeCount = defaults.ReportSurgeCount
	}
	if settings.ReportSurgeWindow <= 0 {
		settings.ReportSurgeWindow = defaults.ReportSurgeWindow
	}
	if settings.SamplingBoost <= 0 {
		settings.SamplingBoost = defaults.SamplingBoost
	}
	if settings.WarningCooldown <= 0 {
		settings.WarningCooldown = defaults.WarningCooldown
	}
	if settings.RepeatOffenderStrike <= 0 {
		settings.RepeatOffenderStrike = defaults.RepeatOffenderStrike
	}
	return settings
}
