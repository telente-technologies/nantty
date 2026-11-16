package updatelivecoinsupport

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

type Result struct {
	LiveId       string `json:"liveId"`
	GiftsEnabled bool   `json:"giftsEnabled"`
}

func HostMayChangeCoinSupport(hostId string, actor uuid.UUID) bool {
	return hostId == actor.String()
}

func LiveStateAllowsCoinSupportChange(state string, isScheduled bool) bool {
	return state == string(livesession.StateConnecting) || state == string(livesession.StateLive) || state == string(livesession.StateIdle) && isScheduled
}

// Execute locks the live_sessions row before changing the preference. Tip
// charging transactions must read this same row FOR SHARE before charging;
// PostgreSQL then serializes a host toggle against an in-flight tip check.
func (handler Handler) Execute(ctx context.Context, actor uuid.UUID, liveId uuid.UUID, enabled bool) (Result, error) {
	var result Result
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		query := "SELECT host_id::text, state, scheduled_at IS NOT NULL FROM " + livesession.Table + " WHERE id = $1 FOR UPDATE"
		var hostId, state string
		var isScheduled bool
		rows, err := tx.Client().QueryContext(ctx, query, liveId)
		if err != nil {
			return fmt.Errorf("lock live session for coin support update: %w", err)
		}
		if !rows.Next() {
			rows.Close()
			if err := rows.Err(); err != nil {
				return fmt.Errorf("lock live session for coin support update: %w", err)
			}
			return httpserver.ErrNotFound
		}
		if err := rows.Scan(&hostId, &state, &isScheduled); err != nil {
			rows.Close()
			return fmt.Errorf("lock live session for coin support update: %w", err)
		}
		if err := rows.Close(); err != nil {
			return fmt.Errorf("close locked live session query: %w", err)
		}
		if !HostMayChangeCoinSupport(hostId, actor) {
			return httpserver.ErrForbidden
		}
		if !LiveStateAllowsCoinSupportChange(state, isScheduled) {
			return httpserver.NewApiError(409, "LIVE_STATE_CONFLICT", "Coin support can only be changed for a scheduled or active live session.")
		}
		updated, err := tx.LiveSession.UpdateOneID(liveId).SetGiftsEnabled(enabled).Save(ctx)
		if err != nil {
			return fmt.Errorf("update live coin support preference: %w", err)
		}
		result = Result{LiveId: updated.ID.String(), GiftsEnabled: updated.GiftsEnabled}
		return nil
	})
	return result, err
}
