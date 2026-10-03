package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/overlayscene"
	"zudomart/modules/live/src/types"
)

func (service *LiveService) findOrCreateMainScene(ctx context.Context, actor types.Actor, liveId uuid.UUID) (*ent.OverlayScene, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return nil, err
	}
	row, err := service.Client.OverlayScene.Query().Where(overlayscene.LiveID(liveId), overlayscene.IsMain(true)).Only(ctx)
	if !ent.IsNotFound(err) {
		return row, err
	}
	err = service.Client.OverlayScene.Create().SetLiveID(liveId).SetOwnerID(actor.UserId).SetName("Main scene").SetLayers([]map[string]any{}).SetIsMain(true).Exec(ctx)
	if err != nil && !ent.IsConstraintError(err) {
		return nil, err
	}
	return service.Client.OverlayScene.Query().Where(overlayscene.LiveID(liveId), overlayscene.IsMain(true)).Only(ctx)
}

func (service *LiveService) GetMainOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.OverlaySceneView, error) {
	row, err := service.findOrCreateMainScene(ctx, actor, liveId)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	return presentScene(row), nil
}

func (service *LiveService) SaveMainOverlayScene(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.OverlaySceneInput) (types.OverlaySceneView, error) {
	existing, err := service.findOrCreateMainScene(ctx, actor, liveId)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	name, layers, err := sceneContent(input, existing.Name)
	if err != nil {
		return types.OverlaySceneView{}, err
	}
	publish := input.Publish == nil || *input.Publish
	return service.saveScene(ctx, existing, name, layers, publish)
}
