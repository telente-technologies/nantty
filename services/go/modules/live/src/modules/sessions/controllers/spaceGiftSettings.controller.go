package controllers

import (
	"encoding/json"
	"net/http"

	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

// UpdateCoinDonations lets only the host control whether a live/scheduled Space
// accepts coin support. The money service still independently enforces this flag.
func (c SpacesController) UpdateCoinDonations(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if !c.rateLimit(w, r, actor.UserId) {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	row, err := c.Container.Client.Space.Get(r.Context(), id)
	if err == nil && !spaceHostAuthorized(row.HostID, actor.UserId) {
		err = httpserver.ErrForbidden
	}
	if err == nil && row.State != space.StateLive && row.State != space.StateScheduled {
		err = httpserver.NewApiError(http.StatusConflict, "SPACE_STATE_CONFLICT", "Coin support can only be changed for a live or scheduled Space.")
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var input struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil || input.Enabled == nil {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "enabled", Message: "must be a boolean"}}))
		return
	}
	updated, err := c.Container.Client.Space.UpdateOneID(id).SetGiftsEnabled(*input.Enabled).Save(r.Context())
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, map[string]any{"spaceId": updated.ID.String(), "giftsEnabled": updated.GiftsEnabled})
}
