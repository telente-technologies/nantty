package listscheduledreports

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adscheduledreport"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/modules/reporting/services"
	adsservices "zudomart/modules/ads/src/services"
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
