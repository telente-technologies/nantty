package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

func (controller PrivacySettingsController) GetProfileOwnership(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	if !utils.SecretsMatch(expected, request.Header.Get("X-Internal-Token")) {
		controller.fail(writer, request, httpserver.ErrUnauthorized)
		return
	}
	targetId, targetError := uuid.Parse(request.PathValue("id"))
	ownerId, ownerError := uuid.Parse(request.URL.Query().Get("ownerUserId"))
	if targetError != nil || ownerError != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	if targetId == ownerId {
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"owned": true})
		return
	}
	row, err := controller.Container.Client.Profile.Query().Where(profile.ID(targetId)).Only(request.Context())
	if ent.IsNotFound(err) {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"owned": row.AccountID == ownerId})
}
