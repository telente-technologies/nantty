package controllers

import (
	"net"
	"net/http"
	"strconv"
	"strings"

	"zudomart/modules/moderation/src/container"
	decideipclaim "zudomart/modules/moderation/src/modules/ipClaims/commands/decideIpClaim"
	respondtoipclaim "zudomart/modules/moderation/src/modules/ipClaims/commands/respondToIpClaim"
	submitipclaim "zudomart/modules/moderation/src/modules/ipClaims/commands/submitIpClaim"
	"zudomart/modules/moderation/src/modules/ipClaims/dtos"
	getipclaim "zudomart/modules/moderation/src/modules/ipClaims/queries/getIpClaim"
	listipclaims "zudomart/modules/moderation/src/modules/ipClaims/queries/listIpClaims"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

type IpClaimsController struct {
	Container *container.Container
}

func (controller IpClaimsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	if forwarded := strings.TrimSpace(request.Header.Get("X-Real-Ip")); forwarded != "" {
		return forwarded
	}
	host, _, _ := net.SplitHostPort(request.RemoteAddr)
	return host
}

func (controller IpClaimsController) Intake(writer http.ResponseWriter, request *http.Request) {
	var body dtos.SubmitRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := submitipclaim.Handler{Container: controller.Container}.Execute(request.Context(), submitipclaim.Command{
		IdempotencyKey: strings.TrimSpace(request.Header.Get("Idempotency-Key")), Kind: body.Kind, ClaimantBrandId: body.ClaimantBrandId, ClaimantBrand: body.ClaimantBrand, ClaimantUserId: body.ClaimantUserId,
		AccusedSellerId: body.AccusedSellerId, ListingId: body.ListingId, Listing: body.Listing, Statement: body.Statement, TrademarkReference: body.TrademarkReference, Evidence: body.Evidence,
	})
	if result.Replayed {
		writer.Header().Set("Idempotent-Replayed", "true")
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller IpClaimsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	cursor, _ := strconv.Atoi(query.Get("cursor"))
	result, err := listipclaims.Handler{Container: controller.Container}.Execute(request.Context(), listipclaims.Query{Status: query.Get("status"), Kind: query.Get("type"), Search: query.Get("search"), Cursor: cursor})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IpClaimsController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getipclaim.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("claimId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IpClaimsController) Decide(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var body dtos.DecideRequest
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		staff, _ := staffauth.StaffFromContext(request.Context())
		result, err := decideipclaim.Handler{Container: controller.Container}.Execute(request.Context(), decideipclaim.Command{
			Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), ClaimId: request.PathValue("claimId"), Action: action, Reason: body.Reason, AddStrike: body.AddStrike == nil || *body.AddStrike,
		})
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		detail, err := getipclaim.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("claimId"))
		if err != nil || action != "uphold" {
			controller.respond(writer, request, http.StatusOK, map[string]any{"claim": detail}, err)
			return
		}
		strikeCount := detail.PriorStrikeCount
		controller.respond(writer, request, http.StatusOK, map[string]any{"claim": detail, "sellerStrikeCount": strikeCount, "isRepeatInfringer": strikeservices.IsRepeatInfringer(strikeCount), "strikeAdded": result.StrikeAdded}, nil)
	}
}

func (controller IpClaimsController) Respond(writer http.ResponseWriter, request *http.Request) {
	var body dtos.RespondRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	if err := (respondtoipclaim.Handler{Container: controller.Container}).Execute(request.Context(), principal.UserId, request.PathValue("claimId"), body.Statement); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
