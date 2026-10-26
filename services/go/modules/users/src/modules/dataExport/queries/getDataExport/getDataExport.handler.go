package getdataexport

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/dataexportrequest"
	"nantty/modules/users/src/modules/dataExport/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (*ent.DataExportRequest, error) {
	row, err := handler.Container.Client.DataExportRequest.Query().Where(dataexportrequest.ID(query.ExportId), dataexportrequest.AccountID(query.AccountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, services.ErrExportNotFound
	}
	return row, err
}
