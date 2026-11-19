package developerorganizations

import (
	"errors"
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type InvitationController struct{ Container *container.Container }

func (controller InvitationController) Create(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[CreateInvitationRequest](writer, request, func(value CreateInvitationRequest) error {
		_, emailErr := NormalizeInvitationEmail(value.Email)
		if emailErr != nil || !containsCapability(supportedOrganizationRoles, value.Role) || value.Role == "owner" {
			return errInvalidInvitation
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errInvalidInvitation) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_INVITATION", "Enter a valid Nantty account email and assign a supported non-owner role."))
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	invitation, err := (InvitationService{Container: controller.Container}).Create(request.Context(), principal.UserId, request.PathValue("organizationID"), body)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, invitation)
}

func (controller InvitationController) ListForOrganization(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	invitations, err := (InvitationService{Container: controller.Container}).ListForOrganization(request.Context(), principal.UserId, request.PathValue("organizationID"))
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"invitations": invitations})
}

func (controller InvitationController) ListForAccount(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	invitations, err := (InvitationService{Container: controller.Container}).ListForAccount(request.Context(), principal.UserId)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"invitations": invitations})
}

func (controller InvitationController) Respond(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[struct {
		Response string `json:"response"`
	}](writer, request, func(value struct {
		Response string `json:"response"`
	}) error {
		if value.Response != "accept" && value.Response != "decline" {
			return errInvalidInvitation
		}
		return nil
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_INVITATION_RESPONSE", "Choose accept or decline for this invitation."))
		return
	}
	if err := (InvitationService{Container: controller.Container}).Respond(request.Context(), principal.UserId, request.PathValue("invitationID"), body.Response); err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller InvitationController) Resend(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	invitation, err := (InvitationService{Container: controller.Container}).Resend(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("invitationID"))
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, invitation)
}

func (controller InvitationController) Revoke(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	if err := (InvitationService{Container: controller.Container}).Revoke(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("invitationID")); err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller InvitationController) writeError(writer http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, errInvalidAccount):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
	case errors.Is(err, errOrganizationAccessNotFound), errors.Is(err, errInvitationNotFound):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_INVITATION_NOT_FOUND", "The organization invitation was not found."))
	case errors.Is(err, errOrganizationForbidden):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You do not have permission to manage organization invitations."))
	case errors.Is(err, errInvitationTargetUnavailable):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "INVITATION_ACCOUNT_UNAVAILABLE", "No eligible Nantty account matches that verified email."))
	case errors.Is(err, errInvitationAlreadyExists):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "ORGANIZATION_INVITATION_EXISTS", "That account is already a member or has an active invitation."))
	case errors.Is(err, errInvitationExpired):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusGone, "ORGANIZATION_INVITATION_EXPIRED", "This invitation has expired."))
	case errors.Is(err, errInvitationNotPending):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "ORGANIZATION_INVITATION_CLOSED", "This invitation is no longer pending."))
	case errors.Is(err, errInvitationResendCooldown):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusTooManyRequests, "ORGANIZATION_INVITATION_RESEND_COOLDOWN", "Wait a minute before resending this invitation."))
	case errors.Is(err, errInvalidInvitation):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_INVITATION", "Check the invitation details and try again."))
	default:
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
	}
}
