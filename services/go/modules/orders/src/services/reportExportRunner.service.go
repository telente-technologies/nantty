package services

import (
	"context"
	"log/slog"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/reportexportjob"
	"zudomart/modules/orders/src/modules/reports/dtos"
	"zudomart/platform/money"
)

func RunQueuedReportExports(ctx context.Context, deployed *container.Container, batch int) (int, error) {
	processed := 0
	for processed < batch {
		done, err := runOneQueuedExport(ctx, deployed)
		if err != nil || !done {
			return processed, err
		}
		processed++
	}
	return processed, nil
}

func runOneQueuedExport(ctx context.Context, deployed *container.Container) (bool, error) {
	catalog, err := deployed.Catalog()
	if err != nil {
		return false, err
	}
	found := false
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		job, err := tx.ReportExportJob.Query().Where(reportexportjob.Status("queued")).Order(ent.Asc(reportexportjob.FieldID)).Limit(1).ForUpdate(sql.WithLockAction(sql.SkipLocked)).First(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		found = true
		stores, err := catalog.DescribeStores(ctx, []uuid.UUID{job.StoreID})
		if err != nil {
			return err
		}
		data, err := LoadReportData(ctx, deployed, job.StoreID, money.CurrencyCode(stores[job.StoreID].Currency), job.FromDate, job.ToDate)
		if err != nil {
			return failExport(ctx, job, err)
		}
		result, known := BuildReport(job.Kind, data)
		if !known {
			return failExport(ctx, job, errUnknownReport)
		}
		content, err := RenderReportCsv(result, data.Currency)
		if err != nil {
			return failExport(ctx, job, err)
		}
		return job.Update().SetStatus("completed").SetCsvContent(string(content)).SetRowCount(len(result.Rows)).SetCompletedAt(time.Now()).Exec(ctx)
	})
	return found, err
}

func RunReportExportsUntilContextDone(ctx context.Context, deployed *container.Container) {
	ticker := time.NewTicker(deployed.Settings.ReportExportSweepPeriod)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := RunQueuedReportExports(ctx, deployed, 5); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "report export sweep failed", slog.Any("error", err))
			}
		}
	}
}

var errUnknownReport = ordererrors.ReportNotFound

func failExport(ctx context.Context, job *ent.ReportExportJob, cause error) error {
	message := cause.Error()
	if len(message) > 300 {
		message = message[:300]
	}
	return job.Update().SetStatus("failed").SetErrorMessage(message).SetCompletedAt(time.Now()).Exec(ctx)
}

func ExportViewOf(job *ent.ReportExportJob) dtos.ExportView {
	return dtos.ExportView{
		Id: job.ID.String(), Kind: job.Kind, From: job.FromDate.Format("2006-01-02"), To: job.ToDate.Format("2006-01-02"), Status: job.Status,
		RowCount: job.RowCount, Error: job.ErrorMessage, CreatedAt: job.CreatedAt, CompletedAt: job.CompletedAt,
	}
}
