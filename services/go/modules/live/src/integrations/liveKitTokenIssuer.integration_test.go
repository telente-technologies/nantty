package integrations

import (
	"testing"

	"github.com/livekit/protocol/livekit"
)

func TestAudioOnlyPublisherSourcesExcludeVideoAndScreenShare(t *testing.T) {
	sources := publisherSourcesFor(true)
	if len(sources) != 1 || sources[0] != livekit.TrackSource_MICROPHONE {
		t.Fatalf("audio-only sources = %v, want microphone only", sources)
	}
}
