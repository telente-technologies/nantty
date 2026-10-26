package services

import (
	"context"
	"log/slog"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
)

func (service *LiveService) RemoveGuestFromStage(ctx context.Context, actor types.Actor, liveId, guestUserId uuid.UUID, reason string) error {
	var room string
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveForStageChange(ctx, tx, liveId, &actor, true)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		slot, err := service.findOccupyingSlot(ctx, tx, liveId, guestUserId)
		if err != nil {
			return err
		}
		if slot.Role == guestslot.RoleHost {
			return liveerrors.Unprocessable("CANNOT_REMOVE_HOST", "The host cannot be removed from the stage.")
		}
		if slot, err = service.applySlotEvent(ctx, tx, slot, HostRemovesGuest); err != nil {
			return err
		}
		if err := service.departFromBattle(ctx, tx, session, guestUserId, true); err != nil {
			return err
		}
		if err := service.emitGuestChanged(ctx, tx, events.GuestRemoved, slot, reason); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
	if err == nil {
		service.bestEffortMedia(ctx, "remove participant", service.Media.RemoveParticipant(ctx, room, guestUserId.String()))
	}
	return err
}

func (service *LiveService) MuteStageStreamer(ctx context.Context, actor types.Actor, liveId, targetUserId uuid.UUID, input types.MuteGuestInput) error {
	var room string
	var effectiveAudio, effectiveVideo *bool
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveForStageChange(ctx, tx, liveId, nil, false)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		byHost := session.HostID == actor.UserId && targetUserId != actor.UserId
		if !byHost && targetUserId != actor.UserId {
			return liveerrors.NotLiveHost
		}
		slot, err := service.findOccupyingSlot(ctx, tx, liveId, targetUserId)
		if err != nil {
			return err
		}
		update := slot.Update()
		if err := applyMuteChange(update, slot, input, byHost); err != nil {
			return err
		}
		if slot, err = update.Save(ctx); err != nil {
			return err
		}
		audio, video := slot.AudioMutedByHost || slot.AudioMutedBySelf, slot.VideoMutedByHost || slot.VideoMutedBySelf
		effectiveAudio, effectiveVideo = boolPointerIf(input.Audio != nil, audio), boolPointerIf(input.Video != nil, video)
		if err := service.emitGuestChanged(ctx, tx, events.GuestMuted, slot, ""); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
	if err == nil {
		service.bestEffortMedia(ctx, "mute participant", service.Media.SetParticipantTracksMuted(ctx, room, targetUserId.String(), effectiveAudio, effectiveVideo))
	}
	return err
}

func boolPointerIf(condition, value bool) *bool {
	if !condition {
		return nil
	}
	return &value
}

func applyMuteChange(update *ent.GuestSlotUpdateOne, slot *ent.GuestSlot, input types.MuteGuestInput, byHost bool) error {
	if input.Audio != nil {
		if byHost {
			update.SetAudioMutedByHost(*input.Audio)
		} else if !*input.Audio && slot.AudioMutedByHost {
			return liveerrors.MutedByHost
		} else {
			update.SetAudioMutedBySelf(*input.Audio)
		}
	}
	if input.Video != nil {
		if byHost {
			update.SetVideoMutedByHost(*input.Video)
		} else if !*input.Video && slot.VideoMutedByHost {
			return liveerrors.MutedByHost
		} else {
			update.SetVideoMutedBySelf(*input.Video)
		}
	}
	return nil
}

func (service *LiveService) bestEffortMedia(ctx context.Context, action string, err error) {
	if err != nil {
		service.Logger.WarnContext(ctx, "media server call failed; stage state stays authoritative", slog.String("action", action), slog.Any("error", err))
	}
}
