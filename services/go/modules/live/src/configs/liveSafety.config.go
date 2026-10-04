package configs

import (
	"time"

	platformconfig "zudomart/platform/config"
)

type LiveSafetySettings struct {
	SamplerEnabled        bool
	FrameInterval         time.Duration
	BoostedFrameInterval  time.Duration
	SweepInterval         time.Duration
	FramesBucket          string
	FramesRegion          string
	FramesEndpoint        string
	FramesAccessKey       string
	FramesSecret          string
	FramesPrefix          string
	FrameWidth            int
	FramesQueue           string
	AudioEnabled          bool
	AudioSegmentDuration  time.Duration
	AudioPrefix           string
	AudioQueue            string
	MaximumLivesPerSweep  int
	MaximumFrameStaleness time.Duration
}

func readLiveSafetySettings(reader *platformconfig.EnvironmentReader) LiveSafetySettings {
	return LiveSafetySettings{
		SamplerEnabled:        reader.ReadStringOrDefault("LIVE_SAFETY_SAMPLER_ENABLED", "false") == "true",
		FrameInterval:         reader.ReadDurationOrDefault("LIVE_SAFETY_FRAME_INTERVAL", 5*time.Second),
		BoostedFrameInterval:  reader.ReadDurationOrDefault("LIVE_SAFETY_BOOSTED_FRAME_INTERVAL", 2*time.Second),
		SweepInterval:         reader.ReadDurationOrDefault("LIVE_SAFETY_SWEEP_INTERVAL", time.Second),
		FramesBucket:          reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_BUCKET", ""),
		FramesRegion:          reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_REGION", "us-east-1"),
		FramesEndpoint:        reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_ENDPOINT", ""),
		FramesAccessKey:       reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_ACCESS_KEY", ""),
		FramesSecret:          reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_S3_SECRET", ""),
		FramesPrefix:          reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_PREFIX", "live-safety/frames/"),
		FrameWidth:            reader.ReadIntegerOrDefault("LIVE_SAFETY_FRAME_WIDTH", 640),
		FramesQueue:           reader.ReadStringOrDefault("LIVE_SAFETY_FRAMES_QUEUE", "jobs-live-frames"),
		AudioEnabled:          reader.ReadStringOrDefault("LIVE_SAFETY_AUDIO_ENABLED", "false") == "true",
		AudioSegmentDuration:  reader.ReadDurationOrDefault("LIVE_SAFETY_AUDIO_SEGMENT_DURATION", 30*time.Second),
		AudioPrefix:           reader.ReadStringOrDefault("LIVE_SAFETY_AUDIO_PREFIX", "live-safety/audio/"),
		AudioQueue:            reader.ReadStringOrDefault("LIVE_SAFETY_AUDIO_QUEUE", "jobs-live-audio"),
		MaximumLivesPerSweep:  reader.ReadIntegerOrDefault("LIVE_SAFETY_MAX_LIVES_PER_SWEEP", 500),
		MaximumFrameStaleness: reader.ReadDurationOrDefault("LIVE_SAFETY_MAX_FRAME_STALENESS", 30*time.Second),
	}
}
