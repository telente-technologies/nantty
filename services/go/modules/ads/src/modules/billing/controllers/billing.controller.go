package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	creditaccountfunds "nantty/modules/ads/src/modules/billing/commands/creditAccountFunds"
	setfundingmode "nantty/modules/ads/src/modules/billing/commands/setFundingMode"
	setspendlimit "nantty/modules/ads/src/modules/billing/commands/setSpendLimit"
	"nantty/modules/ads/src/modules/billing/dtos"
	getbillingoverview "nantty/modules/ads/src/modules/billing/queries/getBillingOverview"
	listbillingtransactions "nantty/modules/ads/src/modules/billing/queries/listBillingTransactions"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

type BillingController struct{ Container *container.Container }

func (controller BillingController) run(writer http.ResponseWriter, request *http.Request, work func(user, account uuid.UUID) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		account, err := utils.PathIdentifier(request, "accountId")
		if err != nil {
			return err
		}
		return work(user, account)
	})
}

func (controller BillingController) overview(writer http.ResponseWriter, request *http.Request, user, account uuid.UUID) error {
	result, err := (getbillingoverview.Handler{Container: controller.Container}).Execute(request.Context(), getbillingoverview.Query{AccountId: account, UserId: user})
	if err != nil {
		return err
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
	return nil
}

func (controller BillingController) GetOverview(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error { return controller.overview(writer, request, user, account) })
}

func (controller BillingController) ListTransactions(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		limit, err := utils.PageLimit(request, 50)
		if err != nil {
			return err
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		items, next, err := (listbillingtransactions.Handler{Container: controller.Container}).Execute(request.Context(), listbillingtransactions.Query{AccountId: account, UserId: user, Cursor: cursor, Limit: limit})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller BillingController) SetSpendLimit(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.SpendLimitRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := (setspendlimit.Handler{Container: controller.Container}).Execute(request.Context(), setspendlimit.Command{AccountId: account, UserId: user, Amount: body.Amount}); err != nil {
			return err
		}
		return controller.overview(writer, request, user, account)
	})
}

func (controller BillingController) SetFundingMode(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.FundingModeRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := (setfundingmode.Handler{Container: controller.Container}).Execute(request.Context(), setfundingmode.Command{AccountId: account, UserId: user, FundingMode: body.FundingMode}); err != nil {
			return err
		}
		return controller.overview(writer, request, user, account)
	})
}

func (controller BillingController) CreditFunds(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		account, err := utils.PathIdentifier(request, "accountId")
		if err != nil {
			return err
		}
		var body dtos.CreditFundsRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		command := creditaccountfunds.Command{AccountId: account, Request: body}
		if err := command.Validate(); err != nil {
			return err
		}
		if err := (creditaccountfunds.Handler{Container: controller.Container}).Execute(request.Context(), command); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}
