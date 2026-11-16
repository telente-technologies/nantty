package listfinancereports

import (
	"context"
	"time"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/auditevent"
	"nantty/modules/admin/src/modules/financeReports/models"
)

type Handler struct {
	Container *container.Container
}

var baseReports = []models.FinanceReportSummary{
	{Key: "overview", Title: "Platform Money Overview", Description: "GMV, escrow holds, payouts, coin sales, ads top-ups, and subscriptions by currency."},
	{Key: "escrow_held", Title: "Held & Disputed Escrows", Description: "Open escrow balances with release dates and delivery state."},
	{Key: "stuck_escrows", Title: "Stuck Escrows Queue", Description: "Held or partially refunded escrows missing auto_release_at."},
	{Key: "money_by_aspect", Title: "Revenue & Flow by Aspect", Description: "Payments, withdrawals, and ledger balances broken down by aspect and currency."},
	{Key: "issues", Title: "Financial Issues Queue", Description: "SLA-breaching disputes, aged processing payouts, failed intents, and seller debt."},
}

func (handler Handler) Execute(ctx context.Context) (models.ReportsCatalog, error) {
	rows, err := handler.Container.Client.AuditEvent.Query().
		Where(auditevent.ActionEQ("finance.report.exported")).
		Order(ent.Desc(auditevent.FieldCreatedAt)).
		Limit(20).
		All(ctx)
	if err != nil {
		return models.ReportsCatalog{}, err
	}
	latestByKey := map[string]string{}
	recent := make([]models.FinanceExportRecord, 0, len(rows))
	for _, row := range rows {
		ts := row.CreatedAt.UTC().Format(time.RFC3339)
		if _, exists := latestByKey[row.SubjectID]; !exists {
			latestByKey[row.SubjectID] = ts
		}
		recent = append(recent, models.FinanceExportRecord{
			Id:         row.ID.String(),
			ReportKey:  row.SubjectID,
			ActorId:    row.ActorID,
			ActorName:  row.ActorName,
			Reason:     row.Reason,
			OccurredAt: ts,
		})
	}
	reports := make([]models.FinanceReportSummary, len(baseReports))
	for index, item := range baseReports {
		if ts, ok := latestByKey[item.Key]; ok {
			copyTs := ts
			item.LastExport = &copyTs
		}
		reports[index] = item
	}
	return models.ReportsCatalog{Reports: reports, Recent: recent}, nil
}
