package controllers

import (
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	createlegalversion "nantty/modules/users/src/modules/legal/commands/createLegalVersion"
	publishlegalversion "nantty/modules/users/src/modules/legal/commands/publishLegalVersion"
	recordnoticeprogress "nantty/modules/users/src/modules/legal/commands/recordNoticeProgress"
	rollbacklegaldocument "nantty/modules/users/src/modules/legal/commands/rollbackLegalDocument"
	transitionlegalversion "nantty/modules/users/src/modules/legal/commands/transitionLegalVersion"
	updatelegalversion "nantty/modules/users/src/modules/legal/commands/updateLegalVersion"
	"nantty/modules/users/src/modules/legal/dtos"
	getlegaldocument "nantty/modules/users/src/modules/legal/queries/getLegalDocument"
	getlegalversion "nantty/modules/users/src/modules/legal/queries/getLegalVersion"
	listcurrentpolicyversions "nantty/modules/users/src/modules/legal/queries/listCurrentPolicyVersions"
	listlegaldocuments "nantty/modules/users/src/modules/legal/queries/listLegalDocuments"
	"nantty/modules/users/src/modules/legal/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type LegalController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller LegalController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller LegalController) ListDocuments(writer http.ResponseWriter, request *http.Request) {
	result, err := listlegaldocuments.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) GetDocument(writer http.ResponseWriter, request *http.Request) {
	result, err := getlegaldocument.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("key"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) CreateVersion(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.VersionRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := createlegalversion.Handler{Container: controller.Container}.Execute(request.Context(), createlegalversion.Command{
		Actor: utils.StaffActorFromRequest(request), DocumentKey: request.PathValue("key"), BodyMarkdown: body.BodyMarkdown, ChangeSummary: body.ChangeSummary, EffectiveAt: body.EffectiveAt, IsMaterialChange: body.IsMaterialChange,
	})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller LegalController) UpdateVersion(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.VersionRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := updatelegalversion.Handler{Container: controller.Container}.Execute(request.Context(), updatelegalversion.Command{
		Actor: utils.StaffActorFromRequest(request), VersionId: request.PathValue("versionId"), BodyMarkdown: body.BodyMarkdown, ChangeSummary: body.ChangeSummary, EffectiveAt: body.EffectiveAt, IsMaterialChange: body.IsMaterialChange,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) transition(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		reason := ""
		if action == transitionlegalversion.ActionReturn {
			body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
			if err != nil {
				controller.respond(writer, request, 0, nil, err)
				return
			}
			reason = body.Reason
		}
		result, err := transitionlegalversion.Handler{Container: controller.Container}.Execute(request.Context(), transitionlegalversion.Command{Actor: utils.StaffActorFromRequest(request), VersionId: request.PathValue("versionId"), Action: action, Reason: reason})
		controller.respond(writer, request, http.StatusOK, result, err)
	}
}

func (controller LegalController) Submit() http.HandlerFunc {
	return controller.transition(transitionlegalversion.ActionSubmit)
}
func (controller LegalController) Return() http.HandlerFunc {
	return controller.transition(transitionlegalversion.ActionReturn)
}

func (controller LegalController) Publish(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.PublishRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := publishlegalversion.Handler{Container: controller.Container}.Execute(request.Context(), publishlegalversion.Command{Actor: utils.StaffActorFromRequest(request), VersionId: request.PathValue("versionId"), Reason: body.Reason, AcknowledgeShortNotice: body.AcknowledgeShortNotice})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) Rollback(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.RollbackRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := rollbacklegaldocument.Handler{Container: controller.Container}.Execute(request.Context(), rollbacklegaldocument.Command{Actor: utils.StaffActorFromRequest(request), DocumentKey: request.PathValue("key"), FromVersionId: body.FromVersionId, Reason: body.Reason})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller LegalController) GetVersion(writer http.ResponseWriter, request *http.Request) {
	result, err := getlegalversion.Handler{Container: controller.Container}.Version(request.Context(), request.PathValue("versionId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) GetAcceptance(writer http.ResponseWriter, request *http.Request) {
	result, err := getlegalversion.Handler{Container: controller.Container}.Acceptance(request.Context(), request.PathValue("versionId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) CurrentPolicyVersions(writer http.ResponseWriter, request *http.Request) {
	result, err := listcurrentpolicyversions.Handler{Container: controller.Container}.Execute(request.Context())
	writer.Header().Set("Cache-Control", "public, max-age=60")
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) MyAcceptances(writer http.ResponseWriter, request *http.Request) {
	ids, err := listcurrentpolicyversions.Handler{Container: controller.Container}.AcceptedBy(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, map[string]any{"acceptedPolicyVersionIds": ids}, err)
}

func (controller LegalController) RecordNoticeProgress(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.NoticeProgressRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := recordnoticeprogress.Handler{Container: controller.Container}.Execute(request.Context(), recordnoticeprogress.Command{
		NoticeId: request.PathValue("noticeId"), Status: body.Status, SentCount: body.SentCount, ExcludedHardBounces: body.ExcludedHardBounces, ExcludedSuppressed: body.ExcludedSuppressed, BatchesDone: body.BatchesDone,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) PolicyGate(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	accountId, err := uuid.Parse(request.PathValue("accountId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, httpserver.ErrNotFound)
		return
	}
	gate, err := services.EvaluatePolicyGate(request.Context(), controller.Container.Client, accountId, controller.Container.Now())
	controller.respond(writer, request, http.StatusOK, gate, err)
}
