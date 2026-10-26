package requestdataexport

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/dataexportrequest"
	exportevents "nantty/modules/users/src/modules/dataExport/events"
	"nantty/modules/users/src/modules/dataExport/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.DataExportRequest, error) {
	if command.IdempotencyKey != "" {
		replay, err := handler.Container.Client.DataExportRequest.Query().Where(dataexportrequest.AccountID(command.AccountId), dataexportrequest.IdempotencyKey(command.IdempotencyKey)).Only(ctx)
		if err == nil || !ent.IsNotFound(err) {
			return replay, err
		}
	}
	var created *ent.DataExportRequest
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		recent, err := tx.DataExportRequest.Query().Where(dataexportrequest.AccountID(command.AccountId), dataexportrequest.CreatedAtGT(now.Add(-services.ExportCooldown))).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		active, err := tx.DataExportRequest.Query().Where(dataexportrequest.AccountID(command.AccountId), dataexportrequest.StatusIn(dataexportrequest.StatusRequested, dataexportrequest.StatusProcessing)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		if err := services.EvaluateExportRequestEligibility(now, append(recent, active...)); err != nil {
			return err
		}
		create := tx.DataExportRequest.Create().SetAccountID(command.AccountId)
		if command.IdempotencyKey != "" {
			create.SetIdempotencyKey(command.IdempotencyKey)
		}
		if created, err = create.Save(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, exportevents.DataExportRequestedType, command.AccountId.String(), now, exportevents.DataExportRequestedData{
			AccountId: command.AccountId.String(), ExportId: created.ID.String(), RequestedAt: now.UTC().Format(time.RFC3339),
		})
	})
	return created, err
}
