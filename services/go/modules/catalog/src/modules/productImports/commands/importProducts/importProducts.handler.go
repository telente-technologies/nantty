package importproducts

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/productimportjob"
	"zudomart/modules/catalog/src/modules/productImports/dtos"
	"zudomart/modules/catalog/src/modules/productImports/jobs"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/commerceports"
)

const MaximumRows = 2000

type Handler struct {
	Container *container.Container
}

func Validate(request dtos.ImportRequest) error {
	issues := utils.Issues{}
	utils.ParseIdentifier("locationId", request.LocationId, &issues)
	if len(request.Rows) == 0 || len(request.Rows) > MaximumRows {
		issues.Add("rows", fmt.Sprintf("must contain between 1 and %d rows", MaximumRows))
	}
	return issues.AsError()
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ImportJobView, error) {
	locationId := uuid.MustParse(command.Request.LocationId)
	stock, err := commerceports.Default.InventoryStock()
	if err != nil {
		return dtos.ImportJobView{}, err
	}
	if owned, err := stock.StoreOwnsLocations(ctx, command.Store.StoreId, []uuid.UUID{locationId}); err != nil || !owned {
		return dtos.ImportJobView{}, firstError(err, catalogerrors.InvalidLocation)
	}
	rows, err := json.Marshal(command.Request.Rows)
	if err != nil {
		return dtos.ImportJobView{}, err
	}
	hash := container.FingerprintOfRequest(command.Request)
	job, err := handler.Container.Client.ProductImportJob.Query().Where(productimportjob.StoreID(command.Store.StoreId), productimportjob.IdempotencyKey(command.IdempotencyKey)).Only(ctx)
	if err == nil {
		if job.RequestHash != hash {
			return dtos.ImportJobView{}, container.ErrIdempotencyKeyReused
		}
		return viewOf(job), nil
	}
	if !ent.IsNotFound(err) {
		return dtos.ImportJobView{}, err
	}
	job, err = handler.Container.Client.ProductImportJob.Create().SetStoreID(command.Store.StoreId).SetActorAccountID(command.Actor.AccountId).SetLocationID(locationId).
		SetIdempotencyKey(command.IdempotencyKey).SetRequestHash(hash).SetRows(rows).Save(ctx)
	if ent.IsConstraintError(err) {
		return dtos.ImportJobView{}, container.ErrIdempotencyKeyReused
	}
	if err != nil {
		return dtos.ImportJobView{}, err
	}
	jobs.RunProductImportJob(context.WithoutCancel(ctx), handler.Container, job.ID)
	if job, err = handler.Container.Client.ProductImportJob.Get(ctx, job.ID); err != nil {
		return dtos.ImportJobView{}, err
	}
	summary := fmt.Sprintf("Imported products from CSV: %d created, %d updated, %d failed", job.CreatedCount, job.UpdatedCount, len(job.Failures))
	_ = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return services.RecordStoreAuditInTransaction(ctx, tx, services.AuditRecordFor(command.Store, command.Actor, "product.imported", "product", "", summary))
	})
	return viewOf(job), nil
}

func viewOf(job *ent.ProductImportJob) dtos.ImportJobView {
	failed := job.Failures
	if failed == nil {
		failed = []schema.ProductImportFailure{}
	}
	return dtos.ImportJobView{JobId: job.ID.String(), Status: string(job.Status), Created: job.CreatedCount, Updated: job.UpdatedCount, Failed: failed}
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
