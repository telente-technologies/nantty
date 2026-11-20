package controllers

import (
	"net/http"

	"github.com/google/uuid"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	transitionblackapplication "nantty/modules/users/src/modules/checkmarks/commands/transitionBlackApplication"
	"nantty/modules/users/src/modules/checkmarks/dtos"
	"nantty/modules/users/src/modules/checkmarks/services"
	"nantty/modules/users/src/utils"
)

func (controller CheckmarksController) SendBlackInstitutionalEmailOtp(writer http.ResponseWriter, request *http.Request) {
	accountId, err := uuid.Parse(utils.AccountIdFromRequest(request))
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.ErrAccountUnavailable)
		return
	}
	appId, err := uuid.Parse(request.PathValue("blackId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.NotFound("Application not found."))
		return
	}
	row, err := controller.Container.Client.BlackApplication.Query().Where(blackapplication.ID(appId), blackapplication.AccountID(accountId)).Only(request.Context())
	if ent.IsNotFound(err) {
		controller.respond(writer, request, 0, nil, usersErrors.NotFound("Application not found."))
		return
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	details, err := services.LoadBlackApplicationDetails(request.Context(), controller.Container.Database, row.ID)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if details.InstitutionalEmail == "" {
		controller.respond(writer, request, 0, nil, usersErrors.ValidationFailedFor("institutionalEmail", "no institutional email on application"))
		return
	}
	if details.InstitutionalEmailVerified {
		controller.respond(writer, request, http.StatusOK, map[string]any{"verified": true}, nil)
		return
	}
	otpCode, expiresAt, err := services.IssueInstitutionalEmailOtp(request.Context(), controller.Container, row.ID, accountId, details.InstitutionalEmail)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	_ = services.EnqueueInstitutionalEmailOtpEvents(request.Context(), controller.Container, row.ID, accountId, details.InstitutionalEmail, otpCode, expiresAt)
	controller.respond(writer, request, http.StatusOK, map[string]any{"sent": true, "expiresAt": expiresAt}, nil)
}

func (controller CheckmarksController) VerifyBlackInstitutionalEmail(writer http.ResponseWriter, request *http.Request) {
	accountId, err := uuid.Parse(utils.AccountIdFromRequest(request))
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.ErrAccountUnavailable)
		return
	}
	appId, err := uuid.Parse(request.PathValue("blackId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.NotFound("Application not found."))
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.VerifyBlackEmailRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	ok, code, err := services.VerifyInstitutionalEmailOtp(request.Context(), controller.Container, appId, accountId, body.Code)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if !ok {
		controller.respond(writer, request, 0, nil, usersErrors.ValidationFailedFor("code", code))
		return
	}
	row, err := controller.Container.Client.BlackApplication.Get(request.Context(), appId)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := services.BuildBlackApplicationView(request.Context(), controller.Container, row)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CheckmarksController) SubmitBlackAppeal(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.BlackAppealRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	appeal, err := services.SubmitBlackAppeal(request.Context(), controller.Container, utils.AccountIdFromRequest(request), request.PathValue("blackId"), body.Reason, body.SupportingDetails)
	controller.respond(writer, request, http.StatusCreated, appeal, err)
}

func (controller CheckmarksController) ListBlackAppeals(writer http.ResponseWriter, request *http.Request) {
	appeals, err := services.ListBlackAppeals(request.Context(), controller.Container.Database, request.URL.Query().Get("applicationId"))
	controller.respond(writer, request, http.StatusOK, map[string]any{"data": appeals, "nextCursor": nil}, err)
}

func (controller CheckmarksController) DecideBlackAppeal(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.BlackAppealDecisionRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	appeal, err := services.DecideBlackAppeal(request.Context(), controller.Container, utils.StaffActorFromRequest(request), request.PathValue("appealId"), body.Decision, body.Note)
	controller.respond(writer, request, http.StatusOK, appeal, err)
}

func (controller CheckmarksController) UpdateBlackCheckoutAuthorization(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.BlackCheckoutAuthRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	err = transitionblackapplication.Handler{Container: controller.Container}.Execute(request.Context(), transitionblackapplication.Command{
		Actor: utils.StaffActorFromRequest(request), Id: request.PathValue("blackId"),
		Action: transitionblackapplication.ActionCheckoutAuthorization, Reason: body.Reason,
		CheckoutEnabled: body.Enabled, ExpiresInHours: body.ExpiresInHours,
	})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.respondBlack(writer, request)
}
