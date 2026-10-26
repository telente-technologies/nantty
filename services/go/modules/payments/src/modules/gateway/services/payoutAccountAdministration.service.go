package services

import (
	"context"

	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/connectedaccount"
	"nantty/modules/payments/src/generated/ent/connectedaccountjob"
	"nantty/modules/payments/src/modules/gateway/models"
)

type StuckPayoutAccountView struct {
	UserId  string                           `json:"userId"`
	Account ConnectedAccountView             `json:"account"`
	Jobs    []models.ConnectedAccountJobView `json:"jobs"`
}

func (gateway *PaymentGateway) ListStuckPayoutAccounts(ctx context.Context, limit int) ([]StuckPayoutAccountView, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	accounts, err := client.ConnectedAccount.Query().Where(connectedaccount.Or(
		connectedaccount.StatusIn(connectedaccount.StatusPendingCreation, connectedaccount.StatusFailed),
		connectedaccount.VerificationStatusIn(connectedaccount.VerificationStatusDocumentsRequired, connectedaccount.VerificationStatusUnderReview, connectedaccount.VerificationStatusActionNeeded),
	)).Order(ent.Asc(connectedaccount.FieldUpdatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]StuckPayoutAccountView, 0, len(accounts))
	for _, account := range accounts {
		jobs, err := client.ConnectedAccountJob.Query().Where(connectedaccountjob.UserID(account.UserID), connectedaccountjob.StatusNEQ(connectedaccountjob.StatusSucceeded)).
			Order(ent.Desc(connectedaccountjob.FieldUpdatedAt)).Limit(10).All(ctx)
		if err != nil {
			return nil, err
		}
		view := StuckPayoutAccountView{UserId: account.UserID, Account: ConvertConnectedAccountToView(account), Jobs: []models.ConnectedAccountJobView{}}
		for _, job := range jobs {
			converted := gateway.convertConnectedAccountJob(job)
			converted.Result = nil
			view.Jobs = append(view.Jobs, converted)
		}
		views = append(views, view)
	}
	return views, nil
}
