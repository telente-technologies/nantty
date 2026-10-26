package listscheduledreports

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adscheduledreport"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/reporting/dtos"
	"nantty/modules/ads/src/modules/reporting/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.ScheduledReport, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionReportsView); err != nil {
		return nil, err
	}
	rows, err := deployed.Client.AdScheduledReport.Query().Where(adscheduledreport.AccountID(query.AccountId)).Order(adscheduledreport.ByID(sql.OrderDesc())).Limit(50).All(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]dtos.ScheduledReport, 0, len(rows))
	for _, row := range rows {
		items = append(items, services.PresentScheduledReport(row))
	}
	return items, nil
}
