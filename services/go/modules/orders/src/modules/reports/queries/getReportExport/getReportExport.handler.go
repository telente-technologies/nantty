package getreportexport

import (
	"context"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/reportexportjob"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (*ent.ReportExportJob, error) {
	job, err := handler.Container.Client.ReportExportJob.Query().Where(reportexportjob.ID(query.ExportId), reportexportjob.StoreID(query.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ordererrors.ExportNotFound
	}
	return job, err
}
