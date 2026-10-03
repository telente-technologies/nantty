package getsuspensioncase

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/modules/suspensionCases/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawId string) (services.CaseDetail, error) {
	identifier, err := uuid.Parse(rawId)
	if err != nil {
		return services.CaseDetail{}, httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.SuspensionCase.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.CaseDetail{}, httpserver.ErrNotFound
	}
	if err != nil {
		return services.CaseDetail{}, err
	}
	return services.BuildCaseDetail(ctx, handler.Container, row)
}
