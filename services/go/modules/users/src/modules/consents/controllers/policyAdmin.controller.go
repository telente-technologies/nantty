package controllers

import (
	"net/http"

	publishpolicyversion "nantty/modules/users/src/modules/consents/commands/publishPolicyVersion"
	"nantty/modules/users/src/modules/consents/dtos"
	"nantty/modules/users/src/modules/consents/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

func (controller ConsentsController) PublishPolicyVersion(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	var body dtos.PublishPolicyVersionRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.fail(writer, request, err)
		return
	}
	effectiveAt, err := validators.ValidatePublishPolicyVersionRequest(body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := publishpolicyversion.Handler{Container: controller.Container}.Execute(request.Context(), publishpolicyversion.Command{
		StaffId: staff.Id, StaffRole: staff.Role, Kind: body.Kind, Version: body.Version, EffectiveAt: effectiveAt, Summary: body.Summary, ContentUrl: body.ContentUrl,
		IpAddress: utils.ClientIpAddress(request), UserAgent: utils.TruncateTo(request.UserAgent(), 255), RequestId: httpserver.RequestIdFromContext(request.Context()),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, dtos.ConvertPolicyVersion(row))
}
