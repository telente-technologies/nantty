package controllers

import (
	"net/http"
	"time"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	addstaffmember "nantty/modules/catalog/src/modules/storeTeam/commands/addStaffMember"
	removestaffmember "nantty/modules/catalog/src/modules/storeTeam/commands/removeStaffMember"
	updatestaffmember "nantty/modules/catalog/src/modules/storeTeam/commands/updateStaffMember"
	"nantty/modules/catalog/src/modules/storeTeam/dtos"
	listauditlog "nantty/modules/catalog/src/modules/storeTeam/queries/listAuditLog"
	liststaff "nantty/modules/catalog/src/modules/storeTeam/queries/listStaff"
	searchnanttyusers "nantty/modules/catalog/src/modules/storeTeam/queries/searchNanttyUsers"
	"nantty/modules/catalog/src/modules/storeTeam/validators"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/sellerplans"
)

type StoreTeamController struct {
	Container *container.Container
}

func (controller StoreTeamController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller StoreTeamController) actorOf(request *http.Request) catalogservices.StoreActor {
	store := middlewares.StoreAccessFrom(request.Context())
	return catalogservices.DescribeStoreActor(request.Context(), controller.Container, request, middlewares.AccountIdFrom(request.Context()), store.Role)
}

func (controller StoreTeamController) search(writer http.ResponseWriter, request *http.Request, excludeTeam bool) {
	text := request.URL.Query().Get("q")
	if err := validators.ValidateSearchText(text); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query := searchnanttyusers.Query{Store: middlewares.StoreAccessFrom(request.Context()), CallerId: middlewares.AccountIdFrom(request.Context()), Text: text, ExcludeTeam: excludeTeam}
	view, err := searchnanttyusers.Handler{Container: controller.Container}.Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller StoreTeamController) SearchNanttyUsers(writer http.ResponseWriter, request *http.Request) {
	controller.search(writer, request, false)
}

func (controller StoreTeamController) SearchStaffCandidates(writer http.ResponseWriter, request *http.Request) {
	controller.search(writer, request, true)
}

func (controller StoreTeamController) ListStaff(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 200)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query := liststaff.Query{Store: middlewares.StoreAccessFrom(request.Context()), Text: request.URL.Query().Get("q"), Cursor: request.URL.Query().Get("cursor"), Limit: limit}
	page, err := liststaff.Handler{Container: controller.Container}.Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller StoreTeamController) AddStaff(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.CreateStaffRequest](writer, request, validators.ValidateCreateStaff)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	if body.Permissions != nil && !sellerplans.Default.RequireFeature(writer, request, store.OwnerAccountId, "advanced_permissions") {
		return
	}
	command := addstaffmember.Command{Store: store, Actor: controller.actorOf(request), Plan: sellerplans.Default.PlanOf(request.Context(), store.OwnerAccountId), Request: body}
	view, err := addstaffmember.Handler{Container: controller.Container}.Execute(request.Context(), command)
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller StoreTeamController) UpdateStaff(writer http.ResponseWriter, request *http.Request) {
	memberId, err := utils.PathIdentifier(request, "staffId")
	var body dtos.UpdateStaffRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.UpdateStaffRequest](writer, request, validators.ValidateUpdateStaff)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	if body.Permissions.Present && body.Permissions.Values != nil && !sellerplans.Default.RequireFeature(writer, request, store.OwnerAccountId, "advanced_permissions") {
		return
	}
	command := updatestaffmember.Command{Store: store, Actor: controller.actorOf(request), Plan: sellerplans.Default.PlanOf(request.Context(), store.OwnerAccountId), MemberId: memberId, Request: body}
	view, err := updatestaffmember.Handler{Container: controller.Container}.Execute(request.Context(), command)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller StoreTeamController) RemoveStaff(writer http.ResponseWriter, request *http.Request) {
	memberId, err := utils.PathIdentifier(request, "staffId")
	if err == nil {
		err = removestaffmember.Handler{Container: controller.Container}.Execute(request.Context(), removestaffmember.Command{Store: middlewares.StoreAccessFrom(request.Context()), Actor: controller.actorOf(request), MemberId: memberId})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller StoreTeamController) ListAuditLog(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	query, err := controller.readAuditQuery(request)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query.Store = store
	page, err := listauditlog.Handler{Container: controller.Container}.Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller StoreTeamController) readAuditQuery(request *http.Request) (listauditlog.Query, error) {
	values := request.URL.Query()
	limit, err := utils.ReadPageLimit(request, 50, 200)
	if err != nil {
		return listauditlog.Query{}, err
	}
	var issues utils.Issues
	if len(values.Get("action")) > 60 || len(values.Get("actorId")) > 80 {
		issues.Add("action", "must be at most 60 characters")
	}
	location := time.UTC
	if row, loadError := controller.Container.Client.Store.Get(request.Context(), middlewares.StoreAccessFrom(request.Context()).StoreId); loadError == nil {
		if zone, zoneError := time.LoadLocation(row.Timezone); zoneError == nil {
			location = zone
		}
	}
	query := listauditlog.Query{ActorId: values.Get("actorId"), ActionPrefix: values.Get("action"), Cursor: values.Get("cursor"), Limit: limit}
	if raw := values.Get("from"); raw != "" {
		if day, parseError := time.ParseInLocation(time.DateOnly, raw, location); parseError == nil {
			query.From = &day
		} else {
			issues.Add("from", "must be a date like 2026-10-01")
		}
	}
	if raw := values.Get("to"); raw != "" {
		if day, parseError := time.ParseInLocation(time.DateOnly, raw, location); parseError == nil {
			until := day.AddDate(0, 0, 1)
			query.Until = &until
		} else {
			issues.Add("to", "must be a date like 2026-10-01")
		}
	}
	if query.From != nil && query.Until != nil && !query.From.Before(*query.Until) {
		issues.Add("from", "must be on or before to")
	}
	return query, issues.AsError()
}
