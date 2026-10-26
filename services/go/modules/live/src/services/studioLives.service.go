package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/liveingress"
	"nantty/modules/live/src/generated/ent/liveproduct"
	"nantty/modules/live/src/generated/ent/liveroomsetting"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/types"
)

func (service *LiveService) ListMyLives(ctx context.Context, actor types.Actor, cursor string, limit int) ([]types.StudioLiveView, string, error) {
	query := service.Client.LiveSession.Query().Where(livesession.HostID(actor.UserId)).Order(ent.Desc(livesession.FieldID)).Limit(limit + 1)
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return nil, "", liveerrors.Unprocessable("CURSOR_INVALID", "That page cursor is not valid.")
		}
		query.Where(livesession.IDLT(cursorId))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return nil, "", err
	}
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	views, err := service.presentStudioLives(ctx, rows)
	return views, nextCursor, err
}

func (service *LiveService) presentStudioLives(ctx context.Context, rows []*ent.LiveSession) ([]types.StudioLiveView, error) {
	liveIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		liveIds = append(liveIds, row.ID)
	}
	ingresses, err := service.Client.LiveIngress.Query().Where(liveingress.LiveIDIn(liveIds...), liveingress.StateEQ(liveingress.StateActive)).All(ctx)
	if err != nil {
		return nil, err
	}
	settings, err := service.Client.LiveRoomSetting.Query().Where(liveroomsetting.IDIn(liveIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	products, err := service.Client.LiveProduct.Query().Where(liveproduct.LiveIDIn(liveIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	hintByLive, protocolByLive := map[uuid.UUID]string{}, map[uuid.UUID]string{}
	for _, ingress := range ingresses {
		hintByLive[ingress.LiveID], protocolByLive[ingress.LiveID] = ingress.StreamKeyHint, string(ingress.Protocol)
	}
	recordByLive := map[uuid.UUID]bool{}
	for _, row := range settings {
		recordByLive[row.ID] = row.RecordEnabled
	}
	productsByLive := map[uuid.UUID][]types.LiveProductView{}
	for _, product := range products {
		productsByLive[product.LiveID] = append(productsByLive[product.LiveID], types.LiveProductView{ProductId: product.ProductID.String(), Pinned: product.Pinned})
	}
	views := make([]types.StudioLiveView, 0, len(rows))
	for _, row := range rows {
		view := types.StudioLiveView{
			Id: row.ID.String(), Title: row.Title, Category: string(row.Category), State: string(row.State), CreatedAt: formatTime(row.CreatedAt),
			StartedAt: formatOptionalTime(row.StartedAt), EndedAt: formatOptionalTime(row.EndedAt), ScheduledAt: formatOptionalTime(row.ScheduledAt), Viewers: row.Viewers, PeakViewers: row.PeakViewers,
			Earnings: types.StudioEarnings{Coins: row.CreatorCoins, GiftCount: row.GiftCount}, RecordEnabled: recordByLive[row.ID],
			Visibility: string(row.Visibility), Products: productsByLive[row.ID],
		}
		if view.Products == nil {
			view.Products = []types.LiveProductView{}
		}
		if hint, found := hintByLive[row.ID]; found {
			protocol := protocolByLive[row.ID]
			view.StreamKeyHint, view.IngestProto = &hint, &protocol
		}
		views = append(views, view)
	}
	return views, nil
}
