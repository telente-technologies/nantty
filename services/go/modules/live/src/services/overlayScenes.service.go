package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/generated/ent/overlayscene"
	"nantty/modules/live/src/types"
)

const endedLiveSceneGrace = time.Hour

func presentScene(row *ent.OverlayScene) types.OverlaySceneView {
	return types.OverlaySceneView{
		Id: row.ID, LiveId: row.LiveID.String(), Name: row.Name, Layers: layersFromStored(row.Layers), IsMain: row.IsMain,
		Published: row.PublishedAt != nil, PublishedAt: formatOptionalTime(row.PublishedAt), Revision: row.Revision, UpdatedAt: formatTime(row.UpdatedAt),
	}
}

func (service *LiveService) findOwnedScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, sceneId string) (*ent.OverlayScene, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return nil, err
	}
	row, err := service.Client.OverlayScene.Query().Where(overlayscene.ID(sceneId), overlayscene.LiveID(liveId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, liveerrors.SceneNotFound
	}
	return row, err
}

func (service *LiveService) ListOverlayScenes(ctx context.Context, actor types.Actor, liveId uuid.UUID) ([]types.OverlaySceneView, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return nil, err
	}
	rows, err := service.Client.OverlayScene.Query().Where(overlayscene.LiveID(liveId)).Order(ent.Asc(overlayscene.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]types.OverlaySceneView, 0, len(rows))
	for _, row := range rows {
		views = append(views, presentScene(row))
	}
	return views, nil
}

func (service *LiveService) GetOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, sceneId string) (types.OverlaySceneView, error) {
	row, err := service.findOwnedScene(ctx, actor, liveId, sceneId)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	return presentScene(row), nil
}

func (service *LiveService) CreateOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.OverlaySceneInput) (types.OverlaySceneView, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return types.OverlaySceneView{}, err
	}
	name, layers, err := sceneContent(input, "Untitled scene")
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	var created *ent.OverlayScene
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := service.lockLiveSession(ctx, tx, liveId); err != nil {
			return err
		}
		total, err := tx.OverlayScene.Query().Where(overlayscene.LiveID(liveId)).Count(ctx)
		if err != nil {
			return err
		}
		if total >= maximumScenesPerLive {
			return liveerrors.SceneLimitReached
		}
		created, err = tx.OverlayScene.Create().SetLiveID(liveId).SetOwnerID(actor.UserId).SetName(name).SetLayers(layersToStored(layers)).SetIsMain(total == 0).Save(ctx)
		return err
	})
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	return presentScene(created), nil
}

func sceneContent(input types.OverlaySceneInput, fallbackName string) (string, []types.OverlayLayer, error) {
	name := fallbackName
	if input.Name != nil {
		validated, err := requireSceneName(*input.Name)
		if err != nil {
			return "", nil, err
		}
		name = validated
	}
	layers := []types.OverlayLayer{}
	if input.Layers != nil {
		layers = *input.Layers
	}
	return name, layers, ValidateOverlayLayers(layers)
}

func (service *LiveService) UpdateOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, sceneId string, input types.OverlaySceneInput) (types.OverlaySceneView, error) {
	existing, err := service.findOwnedScene(ctx, actor, liveId, sceneId)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	name, layers := existing.Name, layersFromStored(existing.Layers)
	if input.Name != nil || input.Layers != nil {
		merged := types.OverlaySceneInput{Name: input.Name, Layers: input.Layers}
		if merged.Name == nil {
			merged.Name = &existing.Name
		}
		if merged.Layers == nil {
			merged.Layers = &layers
		}
		if name, layers, err = sceneContent(merged, existing.Name); err != nil {
			return types.OverlaySceneView{}, err
		}
	}
	publish := input.Publish != nil && *input.Publish
	return service.saveScene(ctx, existing, name, layers, publish)
}

func (service *LiveService) saveScene(ctx context.Context, existing *ent.OverlayScene, name string, layers []types.OverlayLayer, publish bool) (types.OverlaySceneView, error) {
	var saved *ent.OverlayScene
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.OverlayScene.UpdateOneID(existing.ID).SetName(name).SetLayers(layersToStored(layers)).AddRevision(1)
		if publish {
			now := service.Now()
			update.SetPublishedLayers(layersToStored(layers)).SetPublishedName(name).SetPublishedAt(now)
		}
		var err error
		if saved, err = update.Save(ctx); err != nil || !publish {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.OverlaySceneUpdated, existing.LiveID.String(), service.Now(), events.OverlaySceneEventData{
			LiveId: existing.LiveID.String(), SceneId: existing.ID, Revision: saved.Revision,
		})
	})
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	return presentScene(saved), nil
}

func (service *LiveService) PublishOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, sceneId string) (types.OverlaySceneView, error) {
	existing, err := service.findOwnedScene(ctx, actor, liveId, sceneId)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	return service.saveScene(ctx, existing, existing.Name, layersFromStored(existing.Layers), true)
}

func (service *LiveService) UnpublishOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, sceneId string) (types.OverlaySceneView, error) {
	existing, err := service.findOwnedScene(ctx, actor, liveId, sceneId)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	var saved *ent.OverlayScene
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		if saved, err = tx.OverlayScene.UpdateOneID(existing.ID).ClearPublishedLayers().ClearPublishedName().ClearPublishedAt().Save(ctx); err != nil || existing.PublishedAt == nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.OverlaySceneHidden, existing.LiveID.String(), service.Now(), events.OverlaySceneEventData{
			LiveId: existing.LiveID.String(), SceneId: existing.ID, Revision: saved.Revision,
		})
	})
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	return presentScene(saved), nil
}

func (service *LiveService) DeleteOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, sceneId string) error {
	existing, err := service.findOwnedScene(ctx, actor, liveId, sceneId)
	if err != nil {
		return err
	}
	if existing.IsMain {
		return liveerrors.MainSceneProtected
	}
	return service.Client.OverlayScene.DeleteOneID(existing.ID).Exec(ctx)
}

func (service *LiveService) GetPublicOverlayScene(ctx context.Context, sceneId string) (types.PublicOverlaySceneView, error) {
	row, err := service.Client.OverlayScene.Get(ctx, sceneId)
	if ent.IsNotFound(err) || (err == nil && row.PublishedAt == nil) {
		return types.PublicOverlaySceneView{}, liveerrors.SceneNotFound
	}
	if err != nil {
		return types.PublicOverlaySceneView{}, err
	}
	session, err := service.Client.LiveSession.Get(ctx, row.LiveID)
	if ent.IsNotFound(err) {
		return types.PublicOverlaySceneView{}, liveerrors.SceneNotFound
	}
	if err != nil {
		return types.PublicOverlaySceneView{}, err
	}
	if session.State == livesession.StateEnded && session.EndedAt != nil && service.Now().Sub(*session.EndedAt) > endedLiveSceneGrace {
		return types.PublicOverlaySceneView{}, liveerrors.SceneNotFound
	}
	name := row.Name
	if row.PublishedName != nil {
		name = *row.PublishedName
	}
	return types.PublicOverlaySceneView{
		Scene: types.PublicOverlayScene{Id: row.ID, LiveId: row.LiveID.String(), Name: name, Layers: layersFromStored(row.PublishedLayers)},
		Live:  types.PublicOverlayLive{Id: session.ID.String(), Title: session.Title, State: string(session.State)},
	}, nil
}
