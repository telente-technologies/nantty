package controllers

import (
	"net/http"
	"strings"

	"nantty/modules/users/src/container"
	acceptterms "nantty/modules/users/src/modules/consents/commands/acceptTerms"
	mergedeviceconsents "nantty/modules/users/src/modules/consents/commands/mergeDeviceConsents"
	setanonymousconsents "nantty/modules/users/src/modules/consents/commands/setAnonymousConsents"
	setmyconsents "nantty/modules/users/src/modules/consents/commands/setMyConsents"
	"nantty/modules/users/src/modules/consents/dtos"
	"nantty/modules/users/src/modules/consents/models"
	getconsentstates "nantty/modules/users/src/modules/consents/queries/getConsentStates"
	getcurrentpolicies "nantty/modules/users/src/modules/consents/queries/getCurrentPolicies"
	listtermsacceptances "nantty/modules/users/src/modules/consents/queries/listTermsAcceptances"
	"nantty/modules/users/src/modules/consents/services"
	"nantty/modules/users/src/modules/consents/validators"
	legalservices "nantty/modules/users/src/modules/legal/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type ConsentsController struct {
	Container *container.Container
	Limiter   *utils.IpRateLimiter
}

func (controller ConsentsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func requestMetadata(request *http.Request, source string) models.RequestMetadata {
	return models.RequestMetadata{IpAddress: utils.ClientIpAddress(request), UserAgent: utils.TruncateTo(request.UserAgent(), 255), Source: source}
}

func (controller ConsentsController) allowAnonymousCaller(writer http.ResponseWriter, request *http.Request) bool {
	if controller.Limiter.Allow(utils.ClientIpAddress(request)) {
		return true
	}
	writer.Header().Set("Retry-After", "60")
	controller.fail(writer, request, httpserver.NewApiError(http.StatusTooManyRequests, "RATE_LIMITED", "Too many requests. Try again in a minute."))
	return false
}

func (controller ConsentsController) ListCurrentPolicies(writer http.ResponseWriter, request *http.Request) {
	rows, err := getcurrentpolicies.Handler{Container: controller.Container}.Execute(request.Context(), getcurrentpolicies.Query{})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	items := make([]dtos.PolicyVersionResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, dtos.ConvertPolicyVersion(row))
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
}

func (controller ConsentsController) GetAnonymousConsents(writer http.ResponseWriter, request *http.Request) {
	if !controller.allowAnonymousCaller(writer, request) {
		return
	}
	deviceId := strings.TrimSpace(request.Header.Get("X-Device-Id"))
	if deviceId == "" {
		deviceId = request.URL.Query().Get("deviceId")
	}
	if !validators.IsValidDeviceId(deviceId) {
		controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "deviceId", Message: "must be 16-128 letters, numbers, dashes or underscores"}}))
		return
	}
	controller.respondWithStates(writer, request, models.Subject{DeviceId: deviceId}, nil)
}

func (controller ConsentsController) SetAnonymousConsents(writer http.ResponseWriter, request *http.Request) {
	if !controller.allowAnonymousCaller(writer, request) {
		return
	}
	var body dtos.SetConsentsRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.fail(writer, request, err)
		return
	}
	if header := strings.TrimSpace(request.Header.Get("X-Device-Id")); header != "" {
		body.DeviceId = &header
	}
	if err := validators.ValidateSetConsentsRequest(body, true); err != nil {
		controller.fail(writer, request, err)
		return
	}
	command := setanonymousconsents.Command{DeviceId: *body.DeviceId, Decisions: dtos.DecisionsFromMap(body.Decisions), Metadata: requestMetadata(request, "anonymous")}
	if body.PolicyVersion != nil {
		command.PolicyVersion = *body.PolicyVersion
	}
	if err := (setanonymousconsents.Handler{Container: controller.Container}).Execute(request.Context(), command); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithStates(writer, request, models.Subject{DeviceId: *body.DeviceId}, nil)
}

func (controller ConsentsController) GetMyConsents(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithStates(writer, request, services.AccountSubject(accountId), nil)
}

func (controller ConsentsController) SetMyConsents(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	var body dtos.SetConsentsRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.fail(writer, request, err)
		return
	}
	if body.Decisions == nil {
		body.Decisions = body.Consents
	}
	acceptsPolicy := body.PolicyVersionId != nil && *body.PolicyVersionId != ""
	if acceptsPolicy {
		metadata := requestMetadata(request, "account")
		if err := legalservices.RecordPolicyAcceptance(request.Context(), controller.Container.Client, accountId, *body.PolicyVersionId, metadata.IpAddress, metadata.UserAgent, controller.Container.Now()); err != nil {
			controller.fail(writer, request, err)
			return
		}
		if len(body.Decisions) == 0 {
			controller.respondWithStates(writer, request, services.AccountSubject(accountId), nil)
			return
		}
	}
	if err := validators.ValidateSetConsentsRequest(body, false); err != nil {
		controller.fail(writer, request, err)
		return
	}
	command := setmyconsents.Command{AccountId: accountId, Decisions: dtos.DecisionsFromMap(body.Decisions), Metadata: requestMetadata(request, "account")}
	if body.PolicyVersion != nil {
		command.PolicyVersion = *body.PolicyVersion
	}
	if err := (setmyconsents.Handler{Container: controller.Container}).Execute(request.Context(), command); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithStates(writer, request, services.AccountSubject(accountId), nil)
}

func (controller ConsentsController) MergeDeviceConsents(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateMergeConsentsRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	merged, err := mergedeviceconsents.Handler{Container: controller.Container}.Execute(request.Context(), mergedeviceconsents.Command{AccountId: accountId, DeviceId: body.DeviceId, Metadata: requestMetadata(request, "device_merge")})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithStates(writer, request, services.AccountSubject(accountId), &merged)
}

func (controller ConsentsController) respondWithStates(writer http.ResponseWriter, request *http.Request, subject models.Subject, merged *int) {
	result, err := getconsentstates.Handler{Container: controller.Container}.Execute(request.Context(), getconsentstates.Query{Subject: subject})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	response := dtos.ConvertConsentResult(result)
	response.Merged = merged
	httpserver.WriteJsonResponse(writer, http.StatusOK, response)
}

func (controller ConsentsController) AcceptTerms(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateAcceptTermsRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := acceptterms.Handler{Container: controller.Container}.Execute(request.Context(), acceptterms.Command{AccountId: accountId, TermsVersion: body.TermsVersion, Metadata: requestMetadata(request, "terms")})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, dtos.ConvertTermsAcceptance(row))
}

func (controller ConsentsController) ListTermsAcceptances(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	rows, err := listtermsacceptances.Handler{Container: controller.Container}.Execute(request.Context(), listtermsacceptances.Query{AccountId: accountId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	items := make([]dtos.TermsAcceptanceResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, dtos.ConvertTermsAcceptance(row))
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
}
