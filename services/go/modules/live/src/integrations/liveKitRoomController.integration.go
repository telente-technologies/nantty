package integrations

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
)

type LiveKitRoomController struct {
	client    livekit.RoomService
	apiKey    string
	apiSecret string
}

func NewLiveKitRoomController(serverUrl, apiKey, apiSecret string) *LiveKitRoomController {
	return &LiveKitRoomController{
		client: livekit.NewRoomServiceProtobufClient(serverUrl, &http.Client{Timeout: 5 * time.Second}), apiKey: apiKey, apiSecret: apiSecret,
	}
}

func (controller *LiveKitRoomController) authorisedContext(ctx context.Context, room string) (context.Context, error) {
	return controller.authorisedContextWithGrant(ctx, room, false)
}

func (controller *LiveKitRoomController) authorisedContextWithGrant(ctx context.Context, room string, canCreate bool) (context.Context, error) {
	token, err := auth.NewAccessToken(controller.apiKey, controller.apiSecret).
		SetVideoGrant(&auth.VideoGrant{RoomAdmin: true, RoomCreate: canCreate, Room: room}).SetValidFor(time.Minute).ToJWT()
	if err != nil {
		return ctx, err
	}
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	return twirp.WithHTTPRequestHeaders(ctx, header)
}

func ignoreMissingParticipant(err error) error {
	var twirpError twirp.Error
	if errors.As(err, &twirpError) && twirpError.Code() == twirp.NotFound {
		return nil
	}
	return err
}

func (controller *LiveKitRoomController) RemoveParticipant(ctx context.Context, room, identity string) error {
	authorised, err := controller.authorisedContext(ctx, room)
	if err != nil {
		return err
	}
	_, err = controller.client.RemoveParticipant(authorised, &livekit.RoomParticipantIdentity{Room: room, Identity: identity})
	return ignoreMissingParticipant(err)
}

func (controller *LiveKitRoomController) SetParticipantTracksMuted(ctx context.Context, room, identity string, audio, video *bool) error {
	authorised, err := controller.authorisedContext(ctx, room)
	if err != nil {
		return err
	}
	participant, err := controller.client.GetParticipant(authorised, &livekit.RoomParticipantIdentity{Room: room, Identity: identity})
	if err != nil {
		return ignoreMissingParticipant(err)
	}
	for _, track := range participant.Tracks {
		muted, relevant := desiredMute(track.Type, audio, video)
		if !relevant || track.Muted == muted {
			continue
		}
		_, err := controller.client.MutePublishedTrack(authorised, &livekit.MuteRoomTrackRequest{Room: room, Identity: identity, TrackSid: track.Sid, Muted: muted})
		if err != nil {
			return err
		}
	}
	return nil
}

func desiredMute(trackType livekit.TrackType, audio, video *bool) (muted bool, relevant bool) {
	switch trackType {
	case livekit.TrackType_AUDIO:
		if audio != nil {
			return *audio, true
		}
	case livekit.TrackType_VIDEO:
		if video != nil {
			return *video, true
		}
	}
	return false, false
}

type NoopRoomController struct{}

func (NoopRoomController) RemoveParticipant(context.Context, string, string) error { return nil }
func (NoopRoomController) SetParticipantTracksMuted(context.Context, string, string, *bool, *bool) error {
	return nil
}
