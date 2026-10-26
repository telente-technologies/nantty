package controllers

import (
	"net/http"
	"strconv"

	"nantty/modules/moderation/src/container"
	restoreautomationrule "nantty/modules/moderation/src/modules/automationRules/commands/restoreAutomationRule"
	saveautomationrule "nantty/modules/moderation/src/modules/automationRules/commands/saveAutomationRule"
	"nantty/modules/moderation/src/modules/automationRules/dtos"
	listautomationexecutions "nantty/modules/moderation/src/modules/automationRules/queries/listAutomationExecutions"
	listautomationrules "nantty/modules/moderation/src/modules/automationRules/queries/listAutomationRules"
	"nantty/modules/moderation/src/modules/automationRules/services"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type AutomationRulesController struct {
	Container *container.Container
}

func (controller AutomationRulesController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	return httpserver.ClientIP(request)
}

func (controller AutomationRulesController) Catalog(writer http.ResponseWriter, request *http.Request) {
	controller.respond(writer, request, http.StatusOK, services.DescribeCatalog(), nil)
}

func (controller AutomationRulesController) SampleEvents(writer http.ResponseWriter, request *http.Request) {
	controller.respond(writer, request, http.StatusOK, dtos.Items[services.SampleEvent]{Items: services.ListSampleEvents()}, nil)
}

func (controller AutomationRulesController) Executions(writer http.ResponseWriter, request *http.Request) {
	result, err := listautomationexecutions.Handler{Container: controller.Container}.Execute(request.Context(), request.URL.Query().Get("ruleId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AutomationRulesController) List(writer http.ResponseWriter, request *http.Request) {
	result, err := listautomationrules.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AutomationRulesController) Get(writer http.ResponseWriter, request *http.Request) {
	result, err := listautomationrules.Handler{Container: controller.Container}.Current(request.Context(), request.PathValue("ruleId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AutomationRulesController) Versions(writer http.ResponseWriter, request *http.Request) {
	result, err := listautomationrules.Handler{Container: controller.Container}.Versions(request.Context(), request.PathValue("ruleId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AutomationRulesController) Save(writer http.ResponseWriter, request *http.Request) {
	var body dtos.SaveRuleRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	record, created, err := saveautomationrule.Handler{Container: controller.Container}.Execute(request.Context(), saveautomationrule.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), RuleId: request.PathValue("ruleId"), ExpectedVersion: body.ExpectedVersion, Reason: body.Reason, Content: body.Content,
	})
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	controller.respond(writer, request, status, record, err)
}

func (controller AutomationRulesController) Restore(writer http.ResponseWriter, request *http.Request) {
	version, err := strconv.Atoi(request.PathValue("version"))
	if err != nil || version < 1 {
		controller.respond(writer, request, 0, nil, httpserver.ErrNotFound)
		return
	}
	controller.writeVersion(writer, request, version, false)
}

func (controller AutomationRulesController) Archive(writer http.ResponseWriter, request *http.Request) {
	controller.writeVersion(writer, request, 0, true)
}

func (controller AutomationRulesController) writeVersion(writer http.ResponseWriter, request *http.Request, version int, archive bool) {
	var body dtos.VersionWriteRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	record, err := restoreautomationrule.Handler{Container: controller.Container}.Execute(request.Context(), restoreautomationrule.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), RuleId: request.PathValue("ruleId"), Version: version, ExpectedVersion: body.ExpectedVersion, Reason: body.Reason, Archive: archive,
	})
	controller.respond(writer, request, http.StatusOK, record, err)
}
