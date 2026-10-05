package getapplication

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	applicationservices "zudomart/modules/catalog/src/modules/sellerApplications/services"
	"zudomart/modules/catalog/src/services"
)

type Query struct {
	ApplicationId uuid.UUID
}

type Detail struct {
	applicationservices.ProgramApplication
	History []json.RawMessage `json:"history"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Detail, error) {
	row, err := handler.Container.Client.SellerApplication.Get(ctx, query.ApplicationId)
	if ent.IsNotFound(err) {
		return Detail{}, catalogerrors.NotFound
	}
	if err != nil {
		return Detail{}, err
	}
	return Detail{
		ProgramApplication: applicationservices.Present(ctx, handler.Container, []*ent.SellerApplication{row})[0],
		History:            services.StaffHistory(ctx, handler.Container, applicationservices.SubjectType, row.ID.String()),
	}, nil
}
