package controllers

import (
	"net/http"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent/adboost"
	getboost "zudomart/modules/ads/src/modules/boosts/queries/getBoost"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller BoostsController) Cancel(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		boostId, err := utils.PathIdentifier(request, "boostId")
		if err != nil {
			return err
		}
		owned, err := services.RequireBoostOwner(request.Context(), controller.Container.Client, boostId, userId)
		if err != nil {
			return err
		}
		if owned.Status == adboost.StatusCompleted || owned.Status == adboost.StatusRejected {
			return adserrors.BoostNotCancellable
		}
		if _, err := services.CancelBoost(request.Context(), controller.Container, boostId, services.CancelReasonOwner); err != nil {
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
