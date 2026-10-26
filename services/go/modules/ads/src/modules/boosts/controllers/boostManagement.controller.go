package controllers

import (
	"net/http"

	changeboostbudget "nantty/modules/ads/src/modules/boosts/commands/changeBoostBudget"
	changeboostdelivery "nantty/modules/ads/src/modules/boosts/commands/changeBoostDelivery"
	"nantty/modules/ads/src/modules/boosts/dtos"
	getboost "nantty/modules/ads/src/modules/boosts/queries/getBoost"
	getboostreport "nantty/modules/ads/src/modules/boosts/queries/getBoostReport"
	listboosts "nantty/modules/ads/src/modules/boosts/queries/listBoosts"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

func (controller BoostsController) List(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		statuses, err := listboosts.ParseStatuses(request.URL.Query().Get("status"))
		if err != nil {
			return err
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		limit, err := utils.PageLimit(request, 20)
		if err != nil {
			return err
		}
		items, next, err := (listboosts.Handler{Container: controller.Container}).Execute(request.Context(), listboosts.Query{UserId: userId, Statuses: statuses, Cursor: cursor, Limit: min(limit, 50)})
		if err != nil {
			return err
		}
		writer.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller BoostsController) changeDelivery(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		controller.responder().Run(writer, request, func() error {
			userId, err := utils.ActorUserId(request)
			if err != nil {
				return err
			}
			boostId, err := utils.PathIdentifier(request, "boostId")
			if err != nil {
				return err
			}
			if err := (changeboostdelivery.Handler{Container: controller.Container}).Execute(request.Context(), changeboostdelivery.Command{BoostId: boostId, UserId: userId, Action: action}); err != nil {
				return err
			}
			boost, err := (getboost.Handler{Container: controller.Container}).Execute(request.Context(), getboost.Query{BoostId: boostId, UserId: userId})
			if err != nil {
				return err
			}
			httpserver.WriteJsonResponse(writer, http.StatusOK, boost)
			return nil
		})
	}
}

func (controller BoostsController) Pause(writer http.ResponseWriter, request *http.Request) {
	controller.changeDelivery(changeboostdelivery.ActionPause)(writer, request)
}

func (controller BoostsController) Resume(writer http.ResponseWriter, request *http.Request) {
	controller.changeDelivery(changeboostdelivery.ActionResume)(writer, request)
}

func (controller BoostsController) budgetCommand(request *http.Request, writer http.ResponseWriter) (changeboostbudget.Command, error) {
	userId, err := utils.ActorUserId(request)
	if err != nil {
		return changeboostbudget.Command{}, err
	}
	boostId, err := utils.PathIdentifier(request, "boostId")
	if err != nil {
		return changeboostbudget.Command{}, err
	}
	var body dtos.BoostBudgetChangeRequest
	if err := utils.DecodeBody(writer, request, &body); err != nil {
		return changeboostbudget.Command{}, err
	}
	return changeboostbudget.Command{BoostId: boostId, UserId: userId, IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body}, nil
}

func (controller BoostsController) QuoteBudget(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		command, err := controller.budgetCommand(request, writer)
		if err != nil {
			return err
		}
		quote, err := (changeboostbudget.Handler{Container: controller.Container}).Quote(request.Context(), command)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, quote)
		return nil
	})
}

func (controller BoostsController) ChangeBudget(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		command, err := controller.budgetCommand(request, writer)
		if err != nil {
			return err
		}
		result, err := (changeboostbudget.Handler{Container: controller.Container}).Execute(request.Context(), command)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller BoostsController) Report(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		boostId, err := utils.PathIdentifier(request, "boostId")
		if err != nil {
			return err
		}
		report, err := (getboostreport.Handler{Container: controller.Container}).Execute(request.Context(), getboostreport.Query{BoostId: boostId, UserId: userId})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, report)
		return nil
	})
}
