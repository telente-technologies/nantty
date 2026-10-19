package controllers

import (
	"net/http"
	"slices"

	"github.com/google/uuid"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/adFunds/dtos"
	"zudomart/modules/ads/src/modules/adFunds/services"
	adreviewservices "zudomart/modules/ads/src/modules/adReview/services"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
)

var (
	creditStatuses = []string{"active", "spent", "expired", "revoked"}
	creditSources  = []string{"admin_issued", "cashback", "premium_free_boost", "boost_refund", "legacy"}
)

func staffActor(request *http.Request) services.StaffActor {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	return services.StaffActor{Id: principal.UserId, Name: middlewares.StaffName(principal.Roles)}
}

func requireAdminIdempotencyKey(request *http.Request) (string, error) {
	key := request.Header.Get("Idempotency-Key")
	if !idempotency.IsValidIdempotencyKey(key) {
		return "", adserrors.IdempotencyKeyRequired
	}
	return key, nil
}

func (controller AdFundsController) audit(request *http.Request, action, subjectId, reason string, before, after any) {
	_ = adreviewservices.RecordStaffAction(request, controller.Container, action, "adCredit", subjectId, reason, before, after)
}

func (controller AdFundsController) ListCredits(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		query := request.URL.Query()
		filter := services.CreditListFilter{Status: query.Get("status"), Source: query.Get("source")}
		if (filter.Status != "" && !slices.Contains(creditStatuses, filter.Status)) || (filter.Source != "" && !slices.Contains(creditSources, filter.Source)) {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "Unknown status or source filter."}})
		}
		if raw := query.Get("userId"); raw != "" {
			parsed, err := uuid.Parse(raw)
			if err != nil {
				return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "userId", Message: "is not a valid id"}})
			}
			filter.UserId = &parsed
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		limit, err := utils.PageLimit(request, 50)
		if err != nil {
			return err
		}
		filter.Cursor, filter.Limit = cursor, min(limit, 100)
		items, next, err := services.ListAdminCredits(request.Context(), controller.Container, filter)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller AdFundsController) IssueCredit(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		key, err := requireAdminIdempotencyKey(request)
		if err != nil {
			return err
		}
		var body dtos.IssueAdCreditRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		issued, created, err := services.IssueAdminCredit(request.Context(), controller.Container, staffActor(request), key, body)
		if err != nil {
			return err
		}
		if created {
			controller.audit(request, "adCredit.issued", issued.Id, body.Reason, nil, issued)
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, issued)
		return nil
	})
}

func (controller AdFundsController) RevokeCredit(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		if _, err := requireAdminIdempotencyKey(request); err != nil {
			return err
		}
		creditId, err := utils.PathIdentifier(request, "creditId")
		if err != nil {
			return err
		}
		var body dtos.RevokeAdCreditRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		before, after, err := services.RevokeAdminCredit(request.Context(), controller.Container, staffActor(request), creditId, body.Reason)
		if err != nil {
			return err
		}
		controller.audit(request, "adCredit.revoked", after.Id, body.Reason, before, after)
		httpserver.WriteJsonResponse(writer, http.StatusOK, after)
		return nil
	})
}

func (controller AdFundsController) ListCashback(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		limit, err := utils.PageLimit(request, 50)
		if err != nil {
			return err
		}
		items, next, err := services.ListCashbackSettings(request.Context(), controller.Container, cursor, min(limit, 100))
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller AdFundsController) SetCashback(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.PathIdentifier(request, "userId")
		if err != nil {
			return err
		}
		var body dtos.SetCashbackRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		before, after, err := services.SetCashback(request.Context(), controller.Container, staffActor(request), userId, body)
		if err != nil {
			return err
		}
		controller.audit(request, "adCashback.updated", userId.String(), body.Reason, before, after)
		httpserver.WriteJsonResponse(writer, http.StatusOK, after)
		return nil
	})
}

func (controller AdFundsController) RefundSpend(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		batchId, err := utils.PathIdentifier(request, "batchId")
		if err != nil {
			return err
		}
		var body dtos.SpendRefundRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		result, err := services.RefundAdSpend(request.Context(), controller.Container, batchId, body)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}
