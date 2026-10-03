package createscheduledreport

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adscheduledreport"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/modules/reporting/services"
	"zudomart/modules/ads/src/modules/reporting/validators"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

const maximumScheduledReportsPerAccount = 25

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ScheduledReport, error) {
	deployed := handler.Container
	input, err := validators.ValidateScheduledReport(command.Input)
	if err != nil {
		return dtos.ScheduledReport{}, err
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionReportsView)
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
