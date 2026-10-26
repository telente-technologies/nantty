package getmoderationtargetpreview

import (
	"context"
	"net/http"
	"time"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type Preview struct {
	OwnerId    string   `json:"ownerId"`
	Title      *string  `json:"title"`
	Text       *string  `json:"text"`
	MediaUrls  []string `json:"mediaUrls"`
	SoundTitle *string  `json:"soundTitle"`
	CreatedAt  string   `json:"createdAt"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Preview, error) {
	session, err := handler.Container.Client.LiveSession.Get(ctx, query.LiveId)
	if ent.IsNotFound(err) {
		return Preview{}, httpserver.NewApiError(http.StatusNotFound, "LIVE_NOT_FOUND", "That live could not be found.")
	}
	if err != nil {
		return Preview{}, err
	}
	media := []string{}
	if session.CoverURL != nil && *session.CoverURL != "" {
		media = append(media, *session.CoverURL)
	}
	return Preview{OwnerId: session.HostID.String(), Title: &session.Title, MediaUrls: media, CreatedAt: session.CreatedAt.UTC().Format(time.RFC3339)}, nil
}
