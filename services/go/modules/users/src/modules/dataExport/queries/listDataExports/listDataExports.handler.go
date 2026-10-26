package listdataexports

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/dataexportrequest"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]*ent.DataExportRequest, error) {
	return handler.Container.Client.DataExportRequest.Query().Where(dataexportrequest.AccountID(query.AccountId)).Order(ent.Desc(dataexportrequest.FieldID)).Limit(20).All(ctx)
}
