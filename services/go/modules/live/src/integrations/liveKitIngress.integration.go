package integrations

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"

	"zudomart/modules/live/src/interfaces"
)

type LiveKitIngressController struct {
	client    livekit.Ingress
	apiKey    string
	apiSecret string
}

func NewLiveKitIngressController(serverUrl, apiKey, apiSecret string) *LiveKitIngressController {
	return &LiveKitIngressController{
		client: livekit.NewIngressProtobufClient(serverUrl, &http.Client{Timeout: 8 * time.Second}), apiKey: apiKey, apiSecret: apiSecret,
	}
}

func (controller *LiveKitIngressController) adminContext(ctx context.Context) (context.Context, error) {
	token, err := auth.NewAccessToken(controller.apiKey, controller.apiSecret).SetVideoGrant(&auth.VideoGrant{IngressAdmin: true}).SetValidFor(time.Minute).ToJWT()
	if err != nil {
		return ctx, err
	}
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	return twirp.WithHTTPRequestHeaders(ctx, header)
}

func (controller *LiveKitIngressController) CreateIngress(ctx context.Context, request interfaces.IngressRequest) (interfaces.IngressCredentials, error) {
	authorised, err := controller.adminContext(ctx)
	if err != nil {
		return interfaces.IngressCredentials{}, err
	}
	inputType := livekit.IngressInput_RTMP_INPUT
	if request.Protocol == interfaces.IngressWhip {
		inputType = livekit.IngressInput_WHIP_INPUT
	}
	info, err := controller.client.CreateIngress(authorised, &livekit.CreateIngressRequest{
		InputType: inputType, Name: request.Room + "-" + string(request.Protocol), RoomName: request.Room,
		ParticipantIdentity: request.ParticipantId, ParticipantName: request.ParticipantName,
	})
	if err != nil {
		return interfaces.IngressCredentials{}, errors.New("livekit create ingress failed: " + redactedTwirpCode(err))
	}
	return interfaces.IngressCredentials{IngressId: info.IngressId, Url: info.Url, StreamKey: info.StreamKey}, nil
}

func (controller *LiveKitIngressController) GetIngress(ctx context.Context, ingressId string) (interfaces.IngressCredentials, error) {
	authorised, err := controller.adminContext(ctx)
	if err != nil {
		return interfaces.IngressCredentials{}, err
	}
	listed, err := controller.client.ListIngress(authorised, &livekit.ListIngressRequest{IngressId: ingressId})
	if err != nil {
		return interfaces.IngressCredentials{}, errors.New("livekit list ingress failed: " + redactedTwirpCode(err))
	}
	if len(listed.Items) == 0 {
		return interfaces.IngressCredentials{}, ErrIngressMissing
	}
	info := listed.Items[0]
	return interfaces.IngressCredentials{IngressId: info.IngressId, Url: info.Url, StreamKey: info.StreamKey}, nil
}

var ingressStatusNames = map[livekit.IngressState_Status]string{
	livekit.IngressState_ENDPOINT_INACTIVE: "inactive", livekit.IngressState_ENDPOINT_BUFFERING: "buffering", livekit.IngressState_ENDPOINT_PUBLISHING: "publishing",
	livekit.IngressState_ENDPOINT_ERROR: "error", livekit.IngressState_ENDPOINT_COMPLETE: "complete",
}

func (controller *LiveKitIngressController) DescribeIngress(ctx context.Context, ingressId string) (interfaces.IngressStatus, error) {
	authorised, err := controller.adminContext(ctx)
	if err != nil {
		return interfaces.IngressStatus{}, err
	}
	listed, err := controller.client.ListIngress(authorised, &livekit.ListIngressRequest{IngressId: ingressId})
	if err != nil {
		return interfaces.IngressStatus{}, errors.New("livekit list ingress failed: " + redactedTwirpCode(err))
	}
	if len(listed.Items) == 0 {
		return interfaces.IngressStatus{}, ErrIngressMissing
	}
	state := listed.Items[0].State
	if state == nil {
		return interfaces.IngressStatus{Status: "inactive"}, nil
	}
	status := interfaces.IngressStatus{Status: ingressStatusNames[state.Status], Error: state.Error}
	if status.Status == "" {
		status.Status = "unknown"
	}
	if video := state.Video; video != nil {
		status.VideoBitrateKbps, status.Width, status.Height, status.Framerate = int(video.AverageBitrate/1000), int(video.Width), int(video.Height), video.Framerate
	}
	if audio := state.Audio; audio != nil {
		status.AudioBitrateKbps = int(audio.AverageBitrate / 1000)
	}
	return status, nil
}

func (controller *LiveKitIngressController) DeleteIngress(ctx context.Context, ingressId string) error {
	authorised, err := controller.adminContext(ctx)
	if err != nil {
		return err
	}
	_, err = controller.client.DeleteIngress(authorised, &livekit.DeleteIngressRequest{IngressId: ingressId})
	if err != nil && !isTwirpNotFound(err) {
		return errors.New("livekit delete ingress failed: " + redactedTwirpCode(err))
	}
	return nil
}

var ErrIngressMissing = errors.New("ingress no longer exists")

func isTwirpNotFound(err error) bool {
	var twirpError twirp.Error
	return errors.As(err, &twirpError) && twirpError.Code() == twirp.NotFound
}

func redactedTwirpCode(err error) string {
	var twirpError twirp.Error
	if errors.As(err, &twirpError) {
		return string(twirpError.Code())
	}
	return "transport error"
}
