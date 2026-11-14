package developerorganizations

import (
	"errors"
	"net/http"
	"strconv"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type Controller struct{ Container *container.Container }

func (controller Controller) Get(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	organization, err := (Service{Container: controller.Container}).Get(request.Context(), principal.UserId, request.PathValue("organizationID"))
	if err != nil {
		if errors.Is(err, errInvalidAccount) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
			return
		}
		if errors.Is(err, errOrganizationAccessNotFound) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "The organization was not found."))
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, organization)
}

func (controller Controller) Update(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[UpdateOrganizationRequest](writer, request, func(value UpdateOrganizationRequest) error {
		return validateCreateRequest(CreateRequest{Name: value.Name, Slug: value.Slug})
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	organization, err := (Service{Container: controller.Container}).Update(request.Context(), principal.UserId, request.PathValue("organizationID"), body)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "The organization was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You do not have permission to update this organization."))
		case errors.Is(err, errInvalidName), errors.Is(err, errInvalidSlug):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION", err.Error()))
		case errors.Is(err, errSlugTaken):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "ORGANIZATION_SLUG_TAKEN", "That organization URL is already in use."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, organization)
}

func (controller Controller) AuditLog(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	entries, err := (Service{Container: controller.Container}).AuditLog(request.Context(), principal.UserId, request.PathValue("organizationID"), limit)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "The organization was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You do not have permission to view organization security events."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"entries": entries})
}

func (controller Controller) List(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	organizations, err := (Service{Container: controller.Container}).List(request.Context(), principal.UserId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"organizations": organizations})
}

func (controller Controller) Access(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	access, err := (Service{Container: controller.Container}).Access(request.Context(), principal.UserId, request.PathValue("organizationID"))
	if err != nil {
		if errors.Is(err, errInvalidAccount) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
			return
		}
		if errors.Is(err, errOrganizationAccessNotFound) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "The organization was not found."))
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, access)
}

func (controller Controller) Roles(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	roles, err := (Service{Container: controller.Container}).Roles(request.Context(), principal.UserId, request.PathValue("organizationID"))
	if err != nil {
		if errors.Is(err, errInvalidAccount) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
			return
		}
		if errors.Is(err, errOrganizationAccessNotFound) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "The organization was not found."))
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"roles": roles})
}

func (controller Controller) Members(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	members, err := (Service{Container: controller.Container}).Members(request.Context(), principal.UserId, request.PathValue("organizationID"))
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "The organization was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You need organization member-management access to view this team."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"members": members})
}

func (controller Controller) Member(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	member, err := (Service{Container: controller.Container}).Member(
		request.Context(), principal.UserId,
		request.PathValue("organizationID"), request.PathValue("memberID"),
	)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_MEMBER_NOT_FOUND", "The organization member was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You need organization member-management access to view this member."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, member)
}

func (controller Controller) UpdateMemberRole(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[UpdateMemberRoleRequest](writer, request, func(value UpdateMemberRoleRequest) error {
		if !containsCapability(supportedOrganizationRoles, value.Role) {
			return errInvalidRole
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errInvalidRole) {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_ROLE", "Choose a role supported by this organization."))
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	member, err := (Service{Container: controller.Container}).UpdateMemberRole(
		request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("memberID"), body,
	)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_MEMBER_NOT_FOUND", "The organization member was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You do not have permission to grant this organization role."))
		case errors.Is(err, errOwnershipTransferRequired):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "OWNERSHIP_TRANSFER_REQUIRED", "Use the ownership transfer workflow to change an organization owner."))
		case errors.Is(err, errInvalidRole):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_ROLE", "Choose a role supported by this organization."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, member)
}

func (controller Controller) RemoveMember(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	err := (Service{Container: controller.Container}).RemoveMember(
		request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("memberID"),
	)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidAccount):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		case errors.Is(err, errOrganizationAccessNotFound):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_MEMBER_NOT_FOUND", "The organization member was not found."))
		case errors.Is(err, errOrganizationForbidden):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("You do not have permission to remove this organization member."))
		case errors.Is(err, errOwnershipTransferRequired):
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "OWNERSHIP_TRANSFER_REQUIRED", "Transfer organization ownership before removing its owner."))
		default:
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		}
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) Create(writer http.ResponseWriter, request *http.Request) {
	principal, authenticated := jwtauth.PrincipalFromContext(request.Context())
	if !authenticated {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate[CreateRequest](writer, request, func(value CreateRequest) error {
		return validateCreateRequest(value)
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	organization, replayed, err := (Service{Container: controller.Container}).Create(request.Context(), principal.UserId, request.Header.Get("Idempotency-Key"), body)
	if err != nil {
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
