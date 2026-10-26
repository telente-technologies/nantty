package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	updateretentionpolicy "nantty/modules/users/src/modules/retention/commands/updateRetentionPolicy"
	"nantty/modules/users/src/modules/retention/dtos"
	listretentionpolicies "nantty/modules/users/src/modules/retention/queries/listRetentionPolicies"
	"nantty/modules/users/src/modules/retention/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type RetentionController struct {
	Container *container.Container
}

func (controller RetentionController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller RetentionController) List(writer http.ResponseWriter, request *http.Request) {
	rows, err := listretentionpolicies.Handler{Container: controller.Container}.Execute(request.Context(), listretentionpolicies.Query{})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	items := make([]dtos.RetentionPolicyResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, dtos.ConvertPolicyToResponse(row))
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
}

func (controller RetentionController) Update(writer http.ResponseWriter, request *http.Request) {
	category := request.PathValue("category")
	if err := validators.ValidateCategory(category); err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateUpdateRetentionPolicyRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	row, err := updateretentionpolicy.Handler{Container: controller.Container}.Execute(request.Context(), updateretentionpolicy.Command{
		Category: category, Action: body.Action, RetentionDays: body.RetentionDays, NeedsLegalReview: *body.NeedsLegalReview, ExpectedVersion: body.ExpectedVersion, Reason: body.Reason,
		StaffId: staff.Id, StaffRole: staff.Role, IpAddress: utils.ClientIpAddress(request), UserAgent: utils.TruncateTo(request.UserAgent(), 255), RequestId: httpserver.RequestIdFromContext(request.Context()),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.ConvertPolicyToResponse(row))
}
