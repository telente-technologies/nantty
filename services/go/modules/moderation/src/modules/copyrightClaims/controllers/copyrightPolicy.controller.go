package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/generated/ent"
	updatecopyrightpolicy "zudomart/modules/moderation/src/modules/copyrightClaims/commands/updateCopyrightPolicy"
	"zudomart/modules/moderation/src/modules/copyrightClaims/dtos"
	"zudomart/modules/moderation/src/modules/copyrightClaims/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

func (controller CopyrightClaimsController) GetPolicy(writer http.ResponseWriter, request *http.Request) {
	result, err := services.LoadPolicySettings(request.Context(), controller.Container.Client)
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CopyrightClaimsController) UpdatePolicy(writer http.ResponseWriter, request *http.Request) {
	var body dtos.UpdatePolicyRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	result, err := updatecopyrightpolicy.Handler{Container: controller.Container}.Execute(request.Context(), updatecopyrightpolicy.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), Reason: body.Reason,
		Settings: services.PolicySettings{
			TakedownDeadlineHours: body.TakedownDeadlineHours, StrikeLifetimeDays: body.StrikeLifetimeDays, WarningLifetimeDays: body.WarningLifetimeDays, StrikeWindowDays: body.StrikeWindowDays,
			RestrictionThreshold: body.RestrictionThreshold, SuspensionReviewThreshold: body.SuspensionReviewThreshold, RestrictionDays: body.RestrictionDays,
		},
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CopyrightClaimsController) RunAudioMatch(writer http.ResponseWriter, request *http.Request) {
	identifier, err := uuid.Parse(request.PathValue("claimId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, httpserver.ErrNotFound)
		return
	}
	claim, err := controller.Container.Client.CopyrightClaim.Get(request.Context(), identifier)
	if ent.IsNotFound(err) {
		err = httpserver.ErrNotFound
	}
	if err == nil {
		err = services.RunAudioMatchAdvice(request.Context(), controller.Container, claim)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Detail(writer, request)
}
