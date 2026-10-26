package services

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/liveingress"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/generated/ent/predicate"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
)

func keyHint(streamKey string) string {
	if len(streamKey) <= 4 {
		return streamKey
	}
	return streamKey[len(streamKey)-4:]
}

func presentStreamKey(row *ent.LiveIngress, credentials interfaces.IngressCredentials) types.StreamKeyView {
	return types.StreamKeyView{
		LiveId: row.LiveID.String(), Protocol: string(row.Protocol), IngestUrl: credentials.Url, StreamKey: credentials.StreamKey,
		KeyHint: row.StreamKeyHint, IssuedAt: formatTime(row.CreatedAt),
	}
}

func (service *LiveService) IssueStreamKey(ctx context.Context, actor types.Actor, liveId uuid.UUID, protocol interfaces.IngressProtocol) (types.StreamKeyView, error) {
	session, err := service.requireHost(ctx, actor, liveId)
	if err != nil {
		return types.StreamKeyView{}, err
	}
	if session.State == livesession.StateEnded {
		return types.StreamKeyView{}, liveerrors.LiveNotActive
	}
	participants, err := service.lookupParticipants(ctx, actor.UserId)
	if err != nil {
		return types.StreamKeyView{}, err
	}
	credentials, err := service.Ingress.CreateIngress(ctx, interfaces.IngressRequest{
		Room: session.LivekitRoom, ParticipantId: actor.UserId.String(), ParticipantName: participants[actor.UserId].Name, Protocol: protocol,
	})
	if err != nil {
		service.Logger.Error("stream key could not be issued", slog.String("liveId", liveId.String()), slog.Any("error", err))
		return types.StreamKeyView{}, liveerrors.IngressUnavailable
	}
	var created *ent.LiveIngress
	var replaced []string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		previous, err := tx.LiveIngress.Query().Where(liveingress.LiveID(liveId), liveingress.ProtocolEQ(liveingress.Protocol(protocol)), liveingress.StateEQ(liveingress.StateActive)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		for _, old := range previous {
			if err := old.Update().SetState(liveingress.StateRevoked).SetRevokedAt(service.Now()).Exec(ctx); err != nil {
				return err
			}
			replaced = append(replaced, old.LivekitIngressID)
		}
		created, err = tx.LiveIngress.Create().SetLiveID(liveId).SetLivekitIngressID(credentials.IngressId).
			SetProtocol(liveingress.Protocol(protocol)).SetStreamKeyHint(keyHint(credentials.StreamKey)).Save(ctx)
		return err
	})
	if err != nil {
		_ = service.Ingress.DeleteIngress(ctx, credentials.IngressId)
		return types.StreamKeyView{}, err
	}
	service.deleteIngressesQuietly(ctx, liveId, replaced)
	return presentStreamKey(created, credentials), nil
}

func (service *LiveService) GetStreamKey(ctx context.Context, actor types.Actor, liveId uuid.UUID, protocol interfaces.IngressProtocol) (types.StreamKeyView, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return types.StreamKeyView{}, err
	}
	row, err := service.Client.LiveIngress.Query().Where(liveingress.LiveID(liveId), liveingress.ProtocolEQ(liveingress.Protocol(protocol)), liveingress.StateEQ(liveingress.StateActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.StreamKeyView{}, liveerrors.StreamKeyMissing
	}
	if err != nil {
		return types.StreamKeyView{}, err
	}
	credentials, err := service.Ingress.GetIngress(ctx, row.LivekitIngressID)
	if errors.Is(err, integrations.ErrIngressMissing) {
		return types.StreamKeyView{}, liveerrors.StreamKeyMissing
	}
	if err != nil {
		service.Logger.Error("stream key could not be read", slog.String("liveId", liveId.String()), slog.Any("error", err))
		return types.StreamKeyView{}, liveerrors.IngressUnavailable
	}
	return presentStreamKey(row, credentials), nil
}

func (service *LiveService) RevokeStreamKey(ctx context.Context, actor types.Actor, liveId uuid.UUID, protocol interfaces.IngressProtocol) error {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return err
	}
	return service.revokeIngresses(ctx, liveId, liveingress.ProtocolEQ(liveingress.Protocol(protocol)))
}

func (service *LiveService) revokeAllStreamKeys(ctx context.Context, liveId uuid.UUID) error {
	return service.revokeIngresses(ctx, liveId, nil)
}

func (service *LiveService) revokeIngresses(ctx context.Context, liveId uuid.UUID, onlyProtocol predicate.LiveIngress) error {
	query := service.Client.LiveIngress.Query().Where(liveingress.LiveID(liveId), liveingress.StateEQ(liveingress.StateActive))
	if onlyProtocol != nil {
		query.Where(onlyProtocol)
	}
	rows, err := query.All(ctx)
	if err != nil {
		return err
	}
	var failures []error
	for _, row := range rows {
		if err := service.Ingress.DeleteIngress(ctx, row.LivekitIngressID); err != nil {
			failures = append(failures, err)
			continue
		}
		failures = append(failures, row.Update().SetState(liveingress.StateRevoked).SetRevokedAt(service.Now()).Exec(ctx))
	}
	return errors.Join(failures...)
}

func (service *LiveService) deleteIngressesQuietly(ctx context.Context, liveId uuid.UUID, ingressIds []string) {
	for _, ingressId := range ingressIds {
		if err := service.Ingress.DeleteIngress(ctx, ingressId); err != nil {
			service.Logger.Warn("old ingress was not deleted", slog.String("liveId", liveId.String()), slog.Any("error", err))
		}
	}
}
