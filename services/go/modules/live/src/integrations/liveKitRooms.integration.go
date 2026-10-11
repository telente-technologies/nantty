package integrations

import (
	"context"

	"github.com/livekit/protocol/livekit"
)

const (
	roomEmptyTimeoutSeconds     = 120
	roomDepartureTimeoutSeconds = 20
)

func (controller *LiveKitRoomController) EnsureRoom(ctx context.Context, room string) error {
	authorised, err := controller.authorisedContextWithGrant(ctx, room, true)
	if err != nil {
		return err
	}
	_, err = controller.client.CreateRoom(authorised, &livekit.CreateRoomRequest{
		Name: room, EmptyTimeout: roomEmptyTimeoutSeconds, DepartureTimeout: roomDepartureTimeoutSeconds,
	})
	return err
}

func (controller *LiveKitRoomController) DeleteRoom(ctx context.Context, room string) error {
	authorised, err := controller.authorisedContextWithGrant(ctx, room, true)
	if err != nil {
		return err
	}
	_, err = controller.client.DeleteRoom(authorised, &livekit.DeleteRoomRequest{Room: room})
	return ignoreMissingParticipant(err)
}

func (NoopRoomController) EnsureRoom(context.Context, string) error { return nil }

func (NoopRoomController) DeleteRoom(context.Context, string) error { return nil }
