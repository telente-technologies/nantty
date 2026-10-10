package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"zudomart/modules/moderation/src/container"
	decidecopyrightclaim "zudomart/modules/moderation/src/modules/copyrightClaims/commands/decideCopyrightClaim"
	decidecounternotice "zudomart/modules/moderation/src/modules/copyrightClaims/commands/decideCounterNotice"
	recordaudiomatches "zudomart/modules/moderation/src/modules/copyrightClaims/commands/recordAudioMatches"
	submitcopyrightclaim "zudomart/modules/moderation/src/modules/copyrightClaims/commands/submitCopyrightClaim"
	submitcounternotice "zudomart/modules/moderation/src/modules/copyrightClaims/commands/submitCounterNotice"
	"zudomart/modules/moderation/src/modules/copyrightClaims/dtos"
	getcopyrightclaim "zudomart/modules/moderation/src/modules/copyrightClaims/queries/getCopyrightClaim"
	listcopyrightclaims "zudomart/modules/moderation/src/modules/copyrightClaims/queries/listCopyrightClaims"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

type CopyrightClaimsController struct {
	Container *container.Container
}

func (controller CopyrightClaimsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	return httpserver.ClientIP(request)
}

func (controller CopyrightClaimsController) Submit(writer http.ResponseWriter, request *http.Request) {
	var body dtos.SubmitClaimRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := submitcopyrightclaim.Handler{Container: controller.Container}.Execute(request.Context(), submitcopyrightclaim.Command{
		ClaimantUserId: principal.UserId, IdempotencyKey: strings.TrimSpace(request.Header.Get("Idempotency-Key")), TargetType: body.TargetType, TargetId: body.TargetId, WorkDescription: body.WorkDescription,
		OwnershipStatement: body.OwnershipStatement, ContactEmail: body.ContactEmail, GoodFaith: body.GoodFaith, ClaimantName: body.ClaimantName, Organization: body.Organization, RepresentativeOf: body.RepresentativeOf,
		ClaimedUrls: body.ClaimedUrls, WorkType: body.WorkType, ClaimScope: body.ClaimScope, ClaimantPhone: body.ClaimantPhone, ClaimantAddress: body.ClaimantAddress, OriginalWorkUrl: body.OriginalWorkUrl,
		OriginalWorkMediaId: body.OriginalWorkMediaId, ProofUrls: body.ProofUrls, ProofMediaIds: body.ProofMediaIds, Segments: body.Segments, AccuracyDeclared: body.AccuracyDeclared, SignatureName: body.SignatureName,
	})
	if result.Replayed {
		writer.Header().Set("Idempotent-Replayed", "true")
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller CopyrightClaimsController) SubmitCounterNotice(writer http.ResponseWriter, request *http.Request) {
	var body dtos.CounterNoticeRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := submitcounternotice.Handler{Container: controller.Container}.Execute(request.Context(), submitcounternotice.Command{
		SubmitterId: principal.UserId, ClaimId: request.PathValue("claimId"), Statement: body.Statement, ContactEmail: body.ContactEmail, GoodFaith: body.GoodFaith,
	})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller CopyrightClaimsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	cursor, _ := strconv.Atoi(query.Get("cursor"))
	result, err := listcopyrightclaims.Handler{Container: controller.Container}.Execute(request.Context(), listcopyrightclaims.Query{Status: query.Get("status"), WorkType: query.Get("workType"), Search: query.Get("search"), Cursor: cursor})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CopyrightClaimsController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getcopyrightclaim.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("claimId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CopyrightClaimsController) Decide(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var body dtos.ReasonRequest
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		staff, _ := staffauth.StaffFromContext(request.Context())
		err := decidecopyrightclaim.Handler{Container: controller.Container}.Execute(request.Context(), decidecopyrightclaim.Command{
			Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), ClaimId: request.PathValue("claimId"), Action: action, Reason: body.Reason,
		})
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		controller.Detail(writer, request)
	}
}

func (controller CopyrightClaimsController) DecideCounterNotice(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var body dtos.ReasonRequest
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		staff, _ := staffauth.StaffFromContext(request.Context())
		err := decidecounternotice.Handler{Container: controller.Container}.Execute(request.Context(), decidecounternotice.Command{
			Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), ClaimId: request.PathValue("claimId"), NoticeId: request.PathValue("noticeId"), Action: action, Reason: body.Reason,
		})
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		controller.Detail(writer, request)
	}
}

func (controller CopyrightClaimsController) RecordAudioMatches(writer http.ResponseWriter, request *http.Request) {
	var body dtos.AudioMatchesRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if err := (recordaudiomatches.Handler{Container: controller.Container}).Execute(request.Context(), request.PathValue("claimId"), body.Matches); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
