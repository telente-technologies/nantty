package redirectadclick

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/tracking/commands/recordAdEvents"
	"nantty/modules/ads/src/modules/tracking/dtos"
	"nantty/modules/ads/src/services"
)

var ErrInvalidClick = errors.New("click link is invalid or expired")

type Command struct {
	Token     string
	UserAgent string
	Platform  string
}

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (string, error) {
	deployed := handler.Container
	claims, err := deployed.Signer.VerifyClick(command.Token)
	if err != nil {
		return "", ErrInvalidClick
	}
	impression, err := deployed.Signer.Verify(claims.ImpressionToken, claims.UserId)
	if err != nil || impression.ImpressionId != claims.ImpressionId || impression.AdId != claims.AdId {
		return "", ErrInvalidClick
	}
	adId, err := uuid.Parse(claims.AdId)
	if err != nil {
		return "", ErrInvalidClick
	}
	row, err := deployed.Client.Ad.Get(ctx, adId)
	if err != nil {
		return "", ErrInvalidClick
	}
	platform := command.Platform
	if platform != "ios" && platform != "android" {
		platform = services.PlatformFromUserAgent(command.UserAgent)
	}
	target, err := services.ResolveClickTarget(row.Creative.Resolved, claims.CardIndex, platform)
	if err != nil || !services.IsSafeClickTarget(target) {
		return "", ErrInvalidClick
	}
	cardIndex := claims.CardIndex
	event := dtos.AdEventDto{EventId: "click:" + claims.ImpressionId, Token: claims.ImpressionToken, Type: "click", CardIndex: &cardIndex}
	if _, recordErr := (recordadevents.Handler{Container: deployed}).Execute(ctx, recordadevents.Command{UserId: claims.UserId, UserAgent: command.UserAgent, Events: []dtos.AdEventDto{event}}); recordErr != nil {
		deployed.Logger.Warn("click logging failed; redirecting anyway", "error", recordErr)
	}
	return target, nil
}
