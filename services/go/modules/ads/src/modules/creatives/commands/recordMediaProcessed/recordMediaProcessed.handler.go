package recordmediaprocessed

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/admedia"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	request := command.Request
	if request.Status != "ready" && request.Status != "failed" {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "Use ready or failed."}})
	}
	update := handler.Container.Client.AdMedia.Update().Where(admedia.ID(command.MediaId), admedia.StatusIn(admedia.StatusProcessing, admedia.StatusReady, admedia.StatusFailed)).SetStatus(admedia.Status(request.Status))
	if request.Status == "ready" {
		if request.Width < 1 || request.Height < 1 {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "width", Message: "Send the processed dimensions."}})
		}
		update.SetWidth(request.Width).SetHeight(request.Height)
		if request.DurationSeconds != nil {
			update.SetDurationSeconds(*request.DurationSeconds)
		}
	}
	updated, err := update.Save(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if updated == 0 {
		return adserrors.MediaNotFound
	}
	return nil
}
