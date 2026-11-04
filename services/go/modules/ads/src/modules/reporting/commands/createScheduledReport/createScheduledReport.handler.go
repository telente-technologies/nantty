package createscheduledreport

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adscheduledreport"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/reporting/dtos"
	"nantty/modules/ads/src/modules/reporting/services"
	"nantty/modules/ads/src/modules/reporting/validators"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

const maximumScheduledReportsPerAccount = 25

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ScheduledReport, error) {
	deployed := handler.Container
	input, err := validators.ValidateScheduledReport(command.Input)
	if err != nil {
		return dtos.ScheduledReport{}, err
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionReportsManage)
	if err != nil {
		return dtos.ScheduledReport{}, err
	}
	existing, err := deployed.Client.AdScheduledReport.Query().Where(adscheduledreport.AccountID(account.ID)).Count(ctx)
	if err != nil {
		return dtos.ScheduledReport{}, err
	}
	if existing >= maximumScheduledReportsPerAccount {
		return dtos.ScheduledReport{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "name", Message: "An ad account can have at most 25 scheduled reports."}})
	}
	row, err := deployed.Client.AdScheduledReport.Create().SetAccountID(account.ID).SetCreatedBy(command.UserId).SetName(input.Name).SetRecipients(input.Recipients).
		SetFrequency(adscheduledreport.Frequency(input.Frequency)).SetBreakdown(input.Breakdown).SetMetrics(input.Metrics).SetNextSendAt(services.NextSendAfter(input.Frequency, deployed.Now())).Save(ctx)
	if err != nil {
		return dtos.ScheduledReport{}, err
	}
	return services.PresentScheduledReport(row), nil
}
