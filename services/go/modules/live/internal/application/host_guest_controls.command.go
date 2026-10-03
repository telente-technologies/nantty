package application

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
)

type MuteGuestInput struct {
	Audio *bool
	Video *bool
}

func (application *LiveApplication) RemoveGuestFromStage(ctx context.Context, actor Actor, liveId, guestUserId uuid.UUID, reason string) error {
	var room string
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveForStageChange(ctx, tx, liveId, &actor, true)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		slot, err := application.findOccupyingSlot(ctx, tx, liveId, guestUserId)
		if err != nil {
			return err
		}
		if slot.Role == guestslot.RoleHost {
			return unprocessable("CANNOT_REMOVE_HOST", "The host cannot be removed from the stage.")
		}
		if slot, err = application.applySlotEvent(ctx, tx, slot, domain.HostRemovesGuest); err != nil {
			return err
		}
		if err := application.departFromBattle(ctx, tx, session, guestUserId, true); err != nil {
			return err
		}
		if err := application.emitGuestChanged(ctx, tx, eventGuestRemoved, slot, reason); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
	if err == nil {
		application.bestEffortMedia(ctx, "remove participant", application.Media.RemoveParticipant(ctx, room, guestUserId.String()))
	}
	return err
}

func (application *LiveApplication) MuteStageStreamer(ctx context.Context, actor Actor, liveId, targetUserId uuid.UUID, input MuteGuestInput) error {
	var room string
	var effectiveAudio, effectiveVideo *bool
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveForStageChange(ctx, tx, liveId, nil, false)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		byHost := session.HostID == actor.UserId && targetUserId != actor.UserId
		if !byHost && targetUserId != actor.UserId {
			return errNotLiveHost
		}
		slot, err := application.findOccupyingSlot(ctx, tx, liveId, targetUserId)
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
		if err := application.emitGuestChanged(ctx, tx, eventGuestMuted, slot, ""); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
	if err == nil {
		application.bestEffortMedia(ctx, "mute participant", application.Media.SetParticipantTracksMuted(ctx, room, targetUserId.String(), effectiveAudio, effectiveVideo))
	}
	return err
}

func boolPointerIf(condition, value bool) *bool {
	if !condition {
		return nil
	}
	return &value
}

func applyMuteChange(update *ent.GuestSlotUpdateOne, slot *ent.GuestSlot, input MuteGuestInput, byHost bool) error {
	if input.Audio != nil {
		if byHost {
			update.SetAudioMutedByHost(*input.Audio)
		} else if !*input.Audio && slot.AudioMutedByHost {
			return errMutedByHost
		} else {
			update.SetAudioMutedBySelf(*input.Audio)
		}
	}
	if input.Video != nil {
		if byHost {
			update.SetVideoMutedByHost(*input.Video)
		} else if !*input.Video && slot.VideoMutedByHost {
			return errMutedByHost
		} else {
			update.SetVideoMutedBySelf(*input.Video)
		}
	}
	return nil
}

func (application *LiveApplication) bestEffortMedia(ctx context.Context, action string, err error) {
	if err != nil {
		application.Logger.WarnContext(ctx, "media server call failed; stage state stays authoritative", slog.String("action", action), slog.Any("error", err))
	}
}
