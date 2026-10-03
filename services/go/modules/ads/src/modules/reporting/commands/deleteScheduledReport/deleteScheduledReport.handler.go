package deletescheduledreport

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent/adscheduledreport"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionReportsView); err != nil {
		return err
	}
	deleted, err := deployed.Client.AdScheduledReport.Delete().Where(adscheduledreport.ID(command.ReportId), adscheduledreport.AccountID(command.AccountId)).Exec(ctx)
	if err != nil {
		return err
	}
	if deleted == 0 {
		return adserrors.ReportNotFound
	}
	return nil
}
