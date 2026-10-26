package integrations

import (
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
)

var publisherSources = []livekit.TrackSource{
	livekit.TrackSource_CAMERA, livekit.TrackSource_MICROPHONE, livekit.TrackSource_SCREEN_SHARE, livekit.TrackSource_SCREEN_SHARE_AUDIO,
}

type TokenIssuer struct {
	ApiKey    string
	ApiSecret string
	PublicUrl string
}

type MediaGrant struct {
	Room       string
	Identity   string
	Name       string
	CanPublish bool
	Role       string
	TimeToLive time.Duration
	AudioOnly  bool
}

func (issuer *TokenIssuer) IssueParticipantToken(grant MediaGrant) (string, error) {
	canSubscribe := true
	canPublishData := grant.CanPublish
	canPublish := grant.CanPublish
	canUpdateOwnMetadata := false
	videoGrant := &auth.VideoGrant{
		RoomJoin: true, Room: grant.Room, CanPublish: &canPublish, CanSubscribe: &canSubscribe, CanPublishData: &canPublishData,
		CanUpdateOwnMetadata: &canUpdateOwnMetadata,
	}
	if canPublish {
		videoGrant.SetCanPublishSources(publisherSourcesFor(grant.AudioOnly))
	}
	token := auth.NewAccessToken(issuer.ApiKey, issuer.ApiSecret).
		SetVideoGrant(videoGrant).
		SetIdentity(grant.Identity).
		SetName(grant.Name).
		SetMetadata(`{"role":"` + grant.Role + `"}`).
		SetValidFor(grant.TimeToLive)
	return token.ToJWT()
}

func publisherSourcesFor(audioOnly bool) []livekit.TrackSource {
	if audioOnly {
		return []livekit.TrackSource{livekit.TrackSource_MICROPHONE}
	}
	return publisherSources
}
