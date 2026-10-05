package controllers

import (
	"net/http"

	createtopic "zudomart/modules/users/src/modules/topics/commands/createTopic"
	updatetopic "zudomart/modules/users/src/modules/topics/commands/updateTopic"
	"zudomart/modules/users/src/modules/topics/dtos"
	listadmintopics "zudomart/modules/users/src/modules/topics/queries/listAdminTopics"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

func acceptAny[Request any](Request) error { return nil }

func (controller TopicsController) write(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller TopicsController) AdminList(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	body, err := listadmintopics.Handler{Container: controller.Container}.List(request.Context(), listadmintopics.Query{Search: query.Get("search"), Status: query.Get("status")})
	controller.write(writer, request, http.StatusOK, body, err)
}

func (controller TopicsController) AdminGet(writer http.ResponseWriter, request *http.Request) {
	body, err := listadmintopics.Handler{Container: controller.Container}.Get(request.Context(), request.PathValue("topicId"))
	controller.write(writer, request, http.StatusOK, body, err)
}

func (controller TopicsController) AdminCreate(writer http.ResponseWriter, request *http.Request) {
	input, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.CreateTopicRequest])
	var body map[string]any
	if err == nil {
		body, err = createtopic.Handler{Container: controller.Container}.Execute(request.Context(), createtopic.Command{Actor: utils.StaffActorFromRequest(request), Name: input.Name, Reason: input.Reason})
	}
	controller.write(writer, request, http.StatusCreated, body, err)
}

func (controller TopicsController) AdminUpdate(writer http.ResponseWriter, request *http.Request) {
	input, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.UpdateTopicRequest])
	var body map[string]any
	if err == nil {
		body, err = updatetopic.Handler{Container: controller.Container}.Execute(request.Context(), updatetopic.Command{
			Actor: utils.StaffActorFromRequest(request), TopicId: request.PathValue("topicId"), Name: input.Name, Status: input.Status, IsTrending: input.IsTrending, Reason: input.Reason,
		})
	}
	controller.write(writer, request, http.StatusOK, body, err)
}
