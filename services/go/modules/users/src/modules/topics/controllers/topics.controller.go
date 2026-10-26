package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	savemytopics "nantty/modules/users/src/modules/topics/commands/saveMyTopics"
	"nantty/modules/users/src/modules/topics/dtos"
	listmytopics "nantty/modules/users/src/modules/topics/queries/listMyTopics"
	listtopics "nantty/modules/users/src/modules/topics/queries/listTopics"
	"nantty/modules/users/src/modules/topics/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type TopicsController struct {
	Container *container.Container
}

func (controller TopicsController) ListTopics(writer http.ResponseWriter, request *http.Request) {
	rows, err := listtopics.Handler{Container: controller.Container}.Execute(request.Context(), listtopics.Query{})
	controller.respond(writer, request, rows, err)
}

func (controller TopicsController) ListMyTopics(writer http.ResponseWriter, request *http.Request) {
	rows, err := listmytopics.Handler{Container: controller.Container}.Execute(request.Context(), listmytopics.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, rows, err)
}

func (controller TopicsController) SaveMyTopics(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.SaveTopicsRequest](writer, request, validators.ValidateSaveTopicsRequest)
	var rows []*ent.Topic
	if err == nil {
		rows, err = savemytopics.Handler{Container: controller.Container}.Execute(request.Context(), savemytopics.Command{AccountId: utils.AccountIdFromRequest(request), TopicIds: body.TopicIds})
	}
	controller.respond(writer, request, rows, err)
}

func (controller TopicsController) respond(writer http.ResponseWriter, request *http.Request, rows []*ent.Topic, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.ConvertTopicsToResponse(rows))
}
