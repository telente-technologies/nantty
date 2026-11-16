package developerorganizations

import (
	"errors"
	"net/http"

	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func (controller Controller) TransferOwnership(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[TransferOwnershipRequest](writer, request, func(value TransferOwnershipRequest) error {
		if value.MemberID == "" || len(value.MemberID) > 64 {
			return errOwnershipTargetNotFound
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errOwnershipTargetNotFound) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_OWNERSHIP_TARGET", "Choose a current organization member."))
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	result, err := (Service{Container: controller.Container}).TransferOwnership(request.Context(), principal.UserId, request.PathValue("organizationID"), body)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound), errors.Is(err, errOwnershipTargetNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_MEMBER_NOT_FOUND", "The organization or selected member was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("Only the current organization owner can transfer ownership."))
		case errors.Is(err, errTransferConfirmationRequired):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "OWNERSHIP_TRANSFER_CONFIRMATION_REQUIRED", "Type TRANSFER OWNERSHIP to confirm this change."))
		case errors.Is(err, errOwnershipTargetInvalid):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "INVALID_OWNERSHIP_TARGET", "Choose a different non-owner organization member."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller Controller) Create(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[CreateRequest](writer, request, func(value CreateRequest) error {
		return ValidateCreateRequest(value)
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	organization, replayed, err := (Service{Container: controller.Container}).Create(request.Context(), principal.UserId, request.Header.Get("Idempotency-Key"), body)
	if err != nil {
		controller.Container.Logger.Error("developer organization creation failed", "error", err)
		status, code, message := http.StatusInternalServerError, "DEVELOPER_ORGANIZATION_FAILED", "Could not create the organization."
		switch {
		case errors.Is(err, errInvalidAccount):
			status, code, message = http.StatusUnauthorized, "INVALID_ACCOUNT", "Sign in again to continue."
		case errors.Is(err, errIdempotencyNeeded):
			status, code, message = http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Provide a valid Idempotency-Key header."
		case errors.Is(err, errInvalidName), errors.Is(err, errInvalidSlug):
			status, code, message = http.StatusBadRequest, "INVALID_ORGANIZATION", err.Error()
		case errors.Is(err, errSlugTaken):
			status, code, message = http.StatusConflict, "ORGANIZATION_SLUG_TAKEN", "That organization URL is already in use."
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(status, code, message))
		return
	}
	status := http.StatusCreated
	if replayed {
		status = http.StatusOK
	}
	httpserver.WriteJsonResponse(writer, status, organization)
}
