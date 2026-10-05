package controllers

import (
	"net/http"

	"zudomart/modules/users/src/container"
	addreservedusernamerule "zudomart/modules/users/src/modules/usernames/commands/addReservedUsernameRule"
	changeusername "zudomart/modules/users/src/modules/usernames/commands/changeUsername"
	releasewithheldusername "zudomart/modules/users/src/modules/usernames/commands/releaseWithheldUsername"
	removereservedusernamerule "zudomart/modules/users/src/modules/usernames/commands/removeReservedUsernameRule"
	withholdusername "zudomart/modules/users/src/modules/usernames/commands/withholdUsername"
	"zudomart/modules/users/src/modules/usernames/dtos"
	getusernamepolicy "zudomart/modules/users/src/modules/usernames/queries/getUsernamePolicy"
	listreservedusernamerules "zudomart/modules/users/src/modules/usernames/queries/listReservedUsernameRules"
	suggestusername "zudomart/modules/users/src/modules/usernames/queries/suggestUsername"
	"zudomart/modules/users/src/modules/usernames/validators"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

type UsernamesController struct {
	Container *container.Container
}

func (controller UsernamesController) respondJson(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller UsernamesController) respondNoContent(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller UsernamesController) GetUsernamePolicy(writer http.ResponseWriter, request *http.Request) {
	view, err := getusernamepolicy.Handler{Container: controller.Container}.Execute(request.Context(), getusernamepolicy.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respondJson(writer, request, http.StatusOK, view, err)
}

func (controller UsernamesController) ChangeUsername(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ChangeUsernameRequest](writer, request, validators.ValidateChangeUsernameRequest)
	if err != nil {
		controller.respondJson(writer, request, 0, nil, err)
		return
	}
	view, err := changeusername.Handler{Container: controller.Container}.Execute(request.Context(), changeusername.Command{AccountId: utils.AccountIdFromRequest(request), Username: body.Username})
	controller.respondJson(writer, request, http.StatusOK, view, err)
}

func (controller UsernamesController) SuggestUsername(writer http.ResponseWriter, request *http.Request) {
	seed := request.URL.Query().Get("seed")
	if len(seed) > 254 {
		seed = seed[:254]
	}
	result, err := suggestusername.Handler{Container: controller.Container}.Execute(request.Context(), suggestusername.Query{Seed: seed})
	controller.respondJson(writer, request, http.StatusOK, result, err)
}

func (controller UsernamesController) ListReservedUsernameRules(writer http.ResponseWriter, request *http.Request) {
	page, err := listreservedusernamerules.Handler{Container: controller.Container}.Execute(request.Context(), listreservedusernamerules.Query{Cursor: request.URL.Query().Get("cursor"), Search: request.URL.Query().Get("q"), Kind: request.URL.Query().Get("kind")})
	controller.respondJson(writer, request, http.StatusOK, page, err)
}

func (controller UsernamesController) AddReservedUsernameRule(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.AddReservedUsernameRuleRequest](writer, request, validators.ValidateAddReservedUsernameRuleRequest)
	if err != nil {
		controller.respondJson(writer, request, 0, nil, err)
		return
	}
	result, err := addreservedusernamerule.Handler{Container: controller.Container}.Execute(request.Context(), addreservedusernamerule.Command{
		Actor: utils.StaffActorFromRequest(request), Term: body.Term, MatchKind: body.MatchKind, Category: body.Category, Note: body.Note, Reason: body.Reason,
	})
	controller.respondJson(writer, request, http.StatusCreated, result, err)
}

func (controller UsernamesController) RemoveReservedUsernameRule(writer http.ResponseWriter, request *http.Request) {
	err := removereservedusernamerule.Handler{Container: controller.Container}.Execute(request.Context(), removereservedusernamerule.Command{Actor: utils.StaffActorFromRequest(request), Id: request.PathValue("ruleId")})
	controller.respondNoContent(writer, request, err)
}

func (controller UsernamesController) WithholdUsername(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.WithholdUsernameRequest](writer, request, validators.ValidateWithholdUsernameRequest)
	if err == nil {
		err = withholdusername.Handler{Container: controller.Container}.Execute(request.Context(), withholdusername.Command{
			Actor: utils.StaffActorFromRequest(request), Username: body.Username, Reason: body.Reason, Note: body.Note,
		})
	}
	controller.respondNoContent(writer, request, err)
}

func (controller UsernamesController) ReleaseWithheldUsername(writer http.ResponseWriter, request *http.Request) {
	err := releasewithheldusername.Handler{Container: controller.Container}.Execute(request.Context(), releasewithheldusername.Command{
		Actor: utils.StaffActorFromRequest(request), Username: request.PathValue("username"), Reason: request.URL.Query().Get("reason"),
	})
	controller.respondNoContent(writer, request, err)
}
