package services

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/live/src/configs"
	"nantty/modules/live/src/container"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"
)

func TestOnlyCreatorProgramMembersCanGoLive(t *testing.T) {
	service := NewLiveService(&container.Container{Settings: configs.LiveSettings{RequireCreatorProgramToHost: true}})
	for _, roles := range [][]string{nil, {"buyer"}, {"seller"}, {"buyer", "seller"}} {
		_, err := service.CreateLiveSession(context.Background(), types.Actor{UserId: uuid.New(), Roles: roles}, types.CreateLiveSessionInput{Title: "hi", Category: "justChatting", Visibility: "public"})
		if !errors.Is(err, liveerrors.CreatorProgramNeeded) {
			t.Errorf("roles %v: expected CreatorProgramNeeded, got %v", roles, err)
		}
	}
}
