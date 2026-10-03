package controllers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	completemediaupload "zudomart/modules/ads/src/modules/creatives/commands/completeMediaUpload"
	createmediaupload "zudomart/modules/ads/src/modules/creatives/commands/createMediaUpload"
	recordmediaprocessed "zudomart/modules/ads/src/modules/creatives/commands/recordMediaProcessed"
	"zudomart/modules/ads/src/modules/creatives/dtos"
	getmedia "zudomart/modules/ads/src/modules/creatives/queries/getMedia"
	listcontentsources "zudomart/modules/ads/src/modules/creatives/queries/listContentSources"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type CreativesController struct{ Container *container.Container }

func (controller CreativesController) run(writer http.ResponseWriter, request *http.Request, work func(user, account uuid.UUID) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		account, err := utils.PathIdentifier(request, "accountId")
		if err != nil {
			return err
		}
		return work(user, account)
	})
}

func (controller CreativesController) ListContentSources(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		limit := 24
		if raw := request.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > 50 {
				return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "limit", Message: "must be 1-50"}})
			}
			limit = parsed
		}
		query := request.URL.Query()
		items, next, err := (listcontentsources.Handler{Container: controller.Container}).Execute(request.Context(), listcontentsources.Query{AccountId: account, UserId: user, Type: query.Get("type"), Search: query.Get("search"), Cursor: query.Get("cursor"), Limit: limit})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller CreativesController) CreateMediaUpload(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.CreateMediaUploadRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		intent, err := (createmediaupload.Handler{Container: controller.Container}).Execute(request.Context(), createmediaupload.Command{AccountId: account, UserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, intent)
		return nil
	})
}

func (controller CreativesController) CompleteMediaUpload(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		media, err := utils.PathIdentifier(request, "mediaId")
		if err != nil {
			return err
		}
		completed, err := (completemediaupload.Handler{Container: controller.Container}).Execute(request.Context(), completemediaupload.Command{AccountId: account, MediaId: media, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, completed)
		return nil
	})
}

func (controller CreativesController) GetMedia(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		media, err := utils.PathIdentifier(request, "mediaId")
		if err != nil {
			return err
		}
		result, err := (getmedia.Handler{Container: controller.Container}).Execute(request.Context(), getmedia.Query{AccountId: account, MediaId: media, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller CreativesController) RecordMediaProcessed(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		media, err := utils.PathIdentifier(request, "mediaId")
		if err != nil {
			return err
		}
		var body dtos.MediaProcessedRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := (recordmediaprocessed.Handler{Container: controller.Container}).Execute(request.Context(), recordmediaprocessed.Command{MediaId: media, Request: body}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}
