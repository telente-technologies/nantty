package jobs

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent/productimportjob"
	"zudomart/modules/catalog/src/modules/productImports/dtos"
	"zudomart/modules/catalog/src/modules/productImports/services"
	catalogservices "zudomart/modules/catalog/src/services"
	platformevents "zudomart/platform/events"
)

const ProductImportJobType = "catalog.productImport"

type jobPayload struct {
	JobId string `json:"jobId"`
}

func EnqueueOrRunProductImport(ctx context.Context, deployed *container.Container, jobId uuid.UUID) {
	payload, _ := json.Marshal(jobPayload{JobId: jobId.String()})
	if deployed.Jobs != nil {
		if err := deployed.Jobs.EnqueueJob(ctx, deployed.Settings.ImportJobsQueue, platformevents.Job{Id: jobId.String(), Type: ProductImportJobType, Payload: payload}); err == nil {
			return
		}
		deployed.Logger.WarnContext(ctx, "product import runs inline: the job queue refused it")
	}
	go RunProductImportJob(context.WithoutCancel(ctx), deployed, jobId)
}

func HandleProductImportJobMessage(deployed *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var job platformevents.Job
		if err := json.Unmarshal(body, &job); err != nil || job.Type != ProductImportJobType {
			return platformevents.ErrPoisonMessage
		}
		var payload jobPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return platformevents.ErrPoisonMessage
		}
		jobId, err := uuid.Parse(payload.JobId)
		if err != nil {
			return platformevents.ErrPoisonMessage
		}
		RunProductImportJob(ctx, deployed, jobId)
		return nil
	}
}

func RunProductImportJob(ctx context.Context, deployed *container.Container, jobId uuid.UUID) {
	claimed, err := deployed.Client.ProductImportJob.Update().Where(productimportjob.ID(jobId), productimportjob.StatusEQ(productimportjob.StatusQueued)).SetStatus(productimportjob.StatusRunning).Save(ctx)
	if err != nil || claimed == 0 {
		return
	}
	job, err := deployed.Client.ProductImportJob.Get(ctx, jobId)
	if err != nil {
		return
	}
	finish := func(outcome services.ImportOutcome, status productimportjob.Status) {
		_ = job.Update().SetStatus(status).SetCreatedCount(outcome.Created).SetUpdatedCount(outcome.Updated).SetFailures(outcome.Failures).SetFinishedAt(deployed.Now()).Exec(ctx)
	}
	access, found, err := catalogservices.FindStoreAccess(ctx, deployed, job.ActorAccountID, &job.StoreID)
	if err != nil || !found || !access.Allows("products:manage") {
		finish(services.ImportOutcome{}, productimportjob.StatusFailed)
		return
	}
	var rows []dtos.ImportRow
	if err := json.Unmarshal(job.Rows, &rows); err != nil {
		finish(services.ImportOutcome{}, productimportjob.StatusFailed)
		return
	}
	plan, err := services.PlanImport(ctx, deployed, access, job.LocationID, rows)
	if err != nil {
		deployed.Logger.WarnContext(ctx, "product import planning failed", "jobId", jobId, "error", err)
		finish(services.ImportOutcome{}, productimportjob.StatusFailed)
		return
	}
	finish(services.ApplyImportPlan(ctx, deployed, access, job.ActorAccountID, plan), productimportjob.StatusCompleted)
}
