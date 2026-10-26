package integrations

import (
	"testing"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
)

func TestAudioOnlyPublisherSourcesExcludeVideoAndScreenShare(t *testing.T) {
	sources := publisherSourcesFor(true)
	if len(sources) != 1 || sources[0] != livekit.TrackSource_MICROPHONE {
		t.Fatalf("audio-only sources = %v, want microphone only", sources)
	}
}

func TestSpaceTokensEnforceListenerAndSpeakerAudioGrants(t *testing.T) {
	issuer := &TokenIssuer{ApiKey: "test-key", ApiSecret: "test-secret"}
	tests := []struct {
		name       string
		canPublish bool
		sources    []livekit.TrackSource
	}{
		{name: "listener cannot publish"},
		{name: "speaker publishes microphone only", canPublish: true, sources: []livekit.TrackSource{livekit.TrackSource_MICROPHONE}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token, err := issuer.IssueParticipantToken(MediaGrant{Room: "space-test", Identity: "user", CanPublish: test.canPublish, AudioOnly: true, Role: "space", TimeToLive: time.Minute})
			if err != nil {
				t.Fatal(err)
			}
			parsed, err := auth.ParseAPIToken(token)
			if err != nil {
				t.Fatal(err)
			}
			_, claims, err := parsed.Verify(issuer.ApiSecret)
			if err != nil {
				t.Fatal(err)
			}
			grant := claims.Video
			if grant == nil || grant.CanPublish == nil || *grant.CanPublish != test.canPublish {
				t.Fatalf("publish grant = %#v, want %v", grant, test.canPublish)
			}
			if got := grant.GetCanPublishSources(); len(got) != len(test.sources) || len(got) > 0 && got[0] != livekit.TrackSource_MICROPHONE {
				t.Fatalf("publish sources = %v, want %v", got, test.sources)
			}
			if grant.CanPublishData == nil || *grant.CanPublishData {
				t.Fatalf("Space token should not publish data: %#v", grant.CanPublishData)
			}
		})
	}
}
