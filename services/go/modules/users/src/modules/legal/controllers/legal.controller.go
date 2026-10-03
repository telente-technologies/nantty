package controllers

import (
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	createlegalversion "zudomart/modules/users/src/modules/legal/commands/createLegalVersion"
	publishlegalversion "zudomart/modules/users/src/modules/legal/commands/publishLegalVersion"
	queuelegalnotice "zudomart/modules/users/src/modules/legal/commands/queueLegalNotice"
	recordnoticeprogress "zudomart/modules/users/src/modules/legal/commands/recordNoticeProgress"
	rollbacklegaldocument "zudomart/modules/users/src/modules/legal/commands/rollbackLegalDocument"
	testsendnoticedraft "zudomart/modules/users/src/modules/legal/commands/testSendNoticeDraft"
	transitionlegalversion "zudomart/modules/users/src/modules/legal/commands/transitionLegalVersion"
	updatelegalversion "zudomart/modules/users/src/modules/legal/commands/updateLegalVersion"
	updatenoticedraft "zudomart/modules/users/src/modules/legal/commands/updateNoticeDraft"
	"zudomart/modules/users/src/modules/legal/dtos"
	getlegaldocument "zudomart/modules/users/src/modules/legal/queries/getLegalDocument"
	getlegalversion "zudomart/modules/users/src/modules/legal/queries/getLegalVersion"
	getnotice "zudomart/modules/users/src/modules/legal/queries/getNotice"
	listcurrentpolicyversions "zudomart/modules/users/src/modules/legal/queries/listCurrentPolicyVersions"
	listlegaldocuments "zudomart/modules/users/src/modules/legal/queries/listLegalDocuments"
	"zudomart/modules/users/src/modules/legal/services"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
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

func (controller LegalController) GetNoticeDraft(writer http.ResponseWriter, request *http.Request) {
	result, err := getnotice.Handler{Container: controller.Container}.Draft(request.Context(), request.PathValue("versionId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) UpdateNoticeDraft(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.NoticeDraftRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := updatenoticedraft.Handler{Container: controller.Container}.Execute(request.Context(), updatenoticedraft.Command{
		Actor: utils.StaffActorFromRequest(request), VersionId: request.PathValue("versionId"), Subject: body.Subject, SummaryText: body.SummaryText, WhatChanged: body.WhatChanged, ReacceptNote: body.ReacceptNote,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) TestSend(writer http.ResponseWriter, request *http.Request) {
	result, err := testsendnoticedraft.Handler{Container: controller.Container}.Execute(request.Context(), testsendnoticedraft.Command{Actor: utils.StaffActorFromRequest(request), VersionId: request.PathValue("versionId")})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) NoticePreview(writer http.ResponseWriter, request *http.Request) {
	result, err := getnotice.Handler{Container: controller.Container}.Preview(request.Context(), request.PathValue("versionId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) ListNotices(writer http.ResponseWriter, request *http.Request) {
	result, err := getnotice.Handler{Container: controller.Container}.List(request.Context())
	controller.respond(writer, request, http.StatusOK, map[string]any{"items": result, "data": result, "nextCursor": nil}, err)
}

func (controller LegalController) GetNotice(writer http.ResponseWriter, request *http.Request) {
	result, err := getnotice.Handler{Container: controller.Container}.Get(request.Context(), request.PathValue("noticeId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LegalController) QueueNotice(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.QueueNoticeRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := queuelegalnotice.Handler{Container: controller.Container}.Execute(request.Context(), queuelegalnotice.Command{Actor: utils.StaffActorFromRequest(request), VersionId: body.VersionId, Reason: body.Reason})
	controller.respond(writer, request, http.StatusCreated, result, err)
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
