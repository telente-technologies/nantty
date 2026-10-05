package controllers

import (
	"net/http"

	"github.com/google/uuid"

	deleterule "zudomart/modules/ads/src/modules/tools/commands/deleteRule"
	saverule "zudomart/modules/ads/src/modules/tools/commands/saveRule"
	"zudomart/modules/ads/src/modules/tools/dtos"
	listrules "zudomart/modules/ads/src/modules/tools/queries/listRules"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller ToolsController) ListRules(writer http.ResponseWriter, request *http.Request) {
	controller.page(writer, request, func(page pageRequest) (any, error) {
		items, next, err := (listrules.Handler{Container: controller.Container}).Execute(request.Context(), listrules.Query{AccountId: page.account, UserId: page.user, Cursor: page.cursor, Limit: page.limit})
		return httpserver.NewCursorPage(items, next), err
	})
}

func (controller ToolsController) CreateRule(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.AutomatedRuleInput
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		created, err := (saverule.Handler{Container: controller.Container}).Execute(request.Context(), saverule.Command{AccountId: account, UserId: user, Create: &body})
		return respond(writer, http.StatusCreated, created, err)
	})
}

func (controller ToolsController) UpdateRule(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.AutomatedRulePatch
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		updated, err := (saverule.Handler{Container: controller.Container}).Execute(request.Context(), saverule.Command{AccountId: account, UserId: user, RuleId: request.PathValue("ruleId"), Patch: &body})
		return respond(writer, http.StatusOK, updated, err)
	})
}

func (controller ToolsController) DeleteRule(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		if err := (deleterule.Handler{Container: controller.Container}).Execute(request.Context(), deleterule.Command{AccountId: account, UserId: user, RuleId: request.PathValue("ruleId")}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}
