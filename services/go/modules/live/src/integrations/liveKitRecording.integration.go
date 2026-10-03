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

type RecordingDestination struct {
	Bucket    string
	Region    string
	Endpoint  string
	AccessKey string
	Secret    string
}

type LiveKitRecordingController struct {
	client      livekit.Egress
	apiKey      string
	apiSecret   string
	destination RecordingDestination
}

func NewLiveKitRecordingController(serverUrl, apiKey, apiSecret string, destination RecordingDestination) *LiveKitRecordingController {
	return &LiveKitRecordingController{
		client: livekit.NewEgressProtobufClient(serverUrl, &http.Client{Timeout: 8 * time.Second}), apiKey: apiKey, apiSecret: apiSecret, destination: destination,
	}
}

func (controller *LiveKitRecordingController) recordContext(ctx context.Context, room string) (context.Context, error) {
	token, err := auth.NewAccessToken(controller.apiKey, controller.apiSecret).SetVideoGrant(&auth.VideoGrant{RoomRecord: true, Room: room}).SetValidFor(time.Minute).ToJWT()
	if err != nil {
		return ctx, err
	}
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	return twirp.WithHTTPRequestHeaders(ctx, header)
}

func (controller *LiveKitRecordingController) StartRoomRecording(ctx context.Context, room, objectKey string) (string, error) {
	if controller.destination.Bucket == "" {
		return "", errors.New("recording bucket is not configured")
	}
	authorised, err := controller.recordContext(ctx, room)
	if err != nil {
		return "", err
	}
	info, err := controller.client.StartRoomCompositeEgress(authorised, &livekit.RoomCompositeEgressRequest{
		RoomName: room, Layout: "speaker",
		FileOutputs: []*livekit.EncodedFileOutput{{
			FileType: livekit.EncodedFileType_MP4, Filepath: objectKey,
			Output: &livekit.EncodedFileOutput_S3{S3: &livekit.S3Upload{
				Bucket: controller.destination.Bucket, Region: controller.destination.Region, Endpoint: controller.destination.Endpoint,
				AccessKey: controller.destination.AccessKey, Secret: controller.destination.Secret, ForcePathStyle: controller.destination.Endpoint != "",
			}},
		}},
	})
	if err != nil {
		return "", errors.New("livekit start egress failed: " + redactedTwirpCode(err))
	}
	return info.EgressId, nil
}

func (controller *LiveKitRecordingController) StopRecording(ctx context.Context, egressId string) error {
	authorised, err := controller.recordContext(ctx, "")
	if err != nil {
		return err
	}
	_, err = controller.client.StopEgress(authorised, &livekit.StopEgressRequest{EgressId: egressId})
	if err != nil && !isTwirpNotFound(err) {
		return errors.New("livekit stop egress failed: " + redactedTwirpCode(err))
	}
	return nil
}
