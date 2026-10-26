package identityverification

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"time"

	"nantty/modules/users/src/container"
	applyrefundoutcome "nantty/modules/users/src/modules/identityVerification/commands/applyRefundOutcome"
	verificationevents "nantty/modules/users/src/modules/identityVerification/events"
	"nantty/modules/users/src/modules/identityVerification/routes"
	"nantty/modules/users/src/modules/identityVerification/services"
	platformevents "nantty/platform/events"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountIdentityVerificationRoutes(mux, c)
}

func RunEligibilityRecheckUntilContextDone(ctx context.Context, c *container.Container) {
	interval := c.Settings.Verification.EligibilityWorkerInterval
	if interval <= 0 {
		interval = time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		services.RecheckQueuedEligibilityOnce(ctx, c, 200)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func HandlesIdentityEvent(eventType string) bool {
	return slices.Contains(verificationevents.RefundOutcomeEventTypes, eventType)
}

func HandleIdentityEvent(ctx context.Context, c *container.Container, eventType string, data json.RawMessage) error {
	var command applyrefundoutcome.Command
	if err := json.Unmarshal(data, &command); err != nil {
		return fmt.Errorf("%w: %v", platformevents.ErrPoisonMessage, err)
	}
	command.EventType = eventType
	return applyrefundoutcome.Handler{Container: c}.Execute(ctx, command)
}
