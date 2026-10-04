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

type SafetyCaptureDestination struct {
	Bucket    string
	Region    string
	Endpoint  string
	AccessKey string
	Secret    string
}

type LiveKitSafetyCapture struct {
	client      livekit.Egress
	apiKey      string
	apiSecret   string
	destination SafetyCaptureDestination
}

func NewLiveKitSafetyCapture(serverUrl, apiKey, apiSecret string, destination SafetyCaptureDestination) *LiveKitSafetyCapture {
	return &LiveKitSafetyCapture{client: livekit.NewEgressProtobufClient(serverUrl, &http.Client{Timeout: 8 * time.Second}), apiKey: apiKey, apiSecret: apiSecret, destination: destination}
}

func (capture *LiveKitSafetyCapture) authorised(ctx context.Context, room string) (context.Context, error) {
	token, err := auth.NewAccessToken(capture.apiKey, capture.apiSecret).SetVideoGrant(&auth.VideoGrant{RoomRecord: true, Room: room}).SetValidFor(time.Minute).ToJWT()
	if err != nil {
		return ctx, err
	}
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	return twirp.WithHTTPRequestHeaders(ctx, header)
}

func (capture *LiveKitSafetyCapture) upload() *livekit.S3Upload {
	return &livekit.S3Upload{
		Bucket: capture.destination.Bucket, Region: capture.destination.Region, Endpoint: capture.destination.Endpoint,
		AccessKey: capture.destination.AccessKey, Secret: capture.destination.Secret, ForcePathStyle: capture.destination.Endpoint != "",
	}
}

func (capture *LiveKitSafetyCapture) StartFrameCapture(ctx context.Context, room, filenamePrefix string, interval time.Duration, width int) (string, error) {
	authorised, err := capture.authorised(ctx, room)
	if err != nil {
		return "", err
	}
	seconds := max(uint32(interval/time.Second), 1)
	info, err := capture.client.StartRoomCompositeEgress(authorised, &livekit.RoomCompositeEgressRequest{
		RoomName: room, Layout: "grid",
		ImageOutputs: []*livekit.ImageOutput{{
			CaptureInterval: seconds, Width: int32(width), Height: int32(width * 9 / 16), FilenamePrefix: filenamePrefix,
			FilenameSuffix: livekit.ImageFileSuffix_IMAGE_SUFFIX_TIMESTAMP, ImageCodec: livekit.ImageCodec_IC_JPEG, DisableManifest: true,
			Output: &livekit.ImageOutput_S3{S3: capture.upload()},
		}},
	})
	if err != nil {
		return "", errors.New("livekit start frame capture failed: " + redactedTwirpCode(err))
	}
	return info.EgressId, nil
}

func (capture *LiveKitSafetyCapture) StartAudioCapture(ctx context.Context, room, filenamePrefix string, segment time.Duration) (string, error) {
	authorised, err := capture.authorised(ctx, room)
	if err != nil {
		return "", err
	}
	info, err := capture.client.StartRoomCompositeEgress(authorised, &livekit.RoomCompositeEgressRequest{
		RoomName: room, AudioOnly: true,
		SegmentOutputs: []*livekit.SegmentedFileOutput{{
			Protocol: livekit.SegmentedFileProtocol_HLS_PROTOCOL, FilenamePrefix: filenamePrefix, PlaylistName: filenamePrefix + "index.m3u8",
			SegmentDuration: max(uint32(segment/time.Second), 5), FilenameSuffix: livekit.SegmentedFileSuffix_TIMESTAMP,
			Output: &livekit.SegmentedFileOutput_S3{S3: capture.upload()},
		}},
	})
	if err != nil {
		return "", errors.New("livekit start audio capture failed: " + redactedTwirpCode(err))
	}
	return info.EgressId, nil
}

func (capture *LiveKitSafetyCapture) StopCapture(ctx context.Context, egressId string) error {
	authorised, err := capture.authorised(ctx, "")
	if err != nil {
		return err
	}
	if _, err = capture.client.StopEgress(authorised, &livekit.StopEgressRequest{EgressId: egressId}); err != nil && !isTwirpNotFound(err) {
		return errors.New("livekit stop capture failed: " + redactedTwirpCode(err))
	}
	return nil
}

func (controller *LiveKitRoomController) SetParticipantCanPublish(ctx context.Context, room, identity string, canPublish bool) error {
	authorised, err := controller.authorisedContext(ctx, room)
	if err != nil {
		return err
	}
	_, err = controller.client.UpdateParticipant(authorised, &livekit.UpdateParticipantRequest{
		Room: room, Identity: identity, Permission: &livekit.ParticipantPermission{CanPublish: canPublish, CanSubscribe: true, CanPublishData: true},
	})
	return ignoreMissingParticipant(err)
}

func (NoopRoomController) SetParticipantCanPublish(context.Context, string, string, bool) error {
	return nil
}
