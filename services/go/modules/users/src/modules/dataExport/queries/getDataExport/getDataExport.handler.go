package getdataexport

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/dataexportrequest"
	"zudomart/modules/users/src/modules/dataExport/services"
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
