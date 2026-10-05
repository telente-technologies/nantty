package checkmarks

import (
	"encoding/json"
	"errors"
	"fmt"

	"context"
	"net/http"
	"time"
	applyentitlement "zudomart/modules/users/src/modules/checkmarks/commands/applyEntitlement"
	platformevents "zudomart/platform/events"

	"zudomart/modules/users/src/container"
	userserrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/modules/checkmarks/routes"
	"zudomart/modules/users/src/modules/checkmarks/services"
	identityverification "zudomart/modules/users/src/modules/identityVerification"
	usersservices "zudomart/modules/users/src/services"

	"github.com/google/uuid"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCheckmarksRoutes(mux, c)
}

func RunSuggestionSchedulerDailyUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		if err := (services.SuggestionScheduler{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "checkmark suggestion scheduler failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	go RunSuggestionSchedulerDailyUntilContextDone(ctx, c)
	ticker := time.NewTicker(c.Settings.Privacy.DeletionWorkerPollInterval)
	defer ticker.Stop()
	for {
		if err := (services.ReverificationWorker{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "checkmark reverification worker failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func ConsumeEntitlementEventsUntilContextDone(ctx context.Context, c *container.Container, production bool) {
	queueName := c.Settings.EntitlementEventsQueue
	if queueName == "" {
		return
	}
	_, queues, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, platformevents.MessageBusSelection{DeployableName: "go-identity", Logger: c.Logger, IsProduction: production})
	if err != nil || queues == nil {
		c.Logger.ErrorContext(ctx, "entitlement consumer disabled: no message broker configured", "error", err)
		return
	}
	handler := services.HandleEntitlementEventMessage(func(ctx context.Context, eventType string, data json.RawMessage) error {
		if eventType == services.AccountRegisteredEventType {
			return ensurePersonalProfileForRegisteredAccount(ctx, c, data)
		}
		if eventType == usersservices.SellerApplicationReviewedEventType {
			return usersservices.GrantSellerRoleOnApproval(ctx, data)
		}
		if identityverification.HandlesIdentityEvent(eventType) {
			return identityverification.HandleIdentityEvent(ctx, c, eventType, data)
		}
		var command applyentitlement.Command
		if err := json.Unmarshal(data, &command); err != nil {
			return fmt.Errorf("%w: %v", platformevents.ErrPoisonMessage, err)
		}
		command.EventType = eventType
		return applyentitlement.Handler{Container: c}.Execute(ctx, command)
	})
	if err := queues.ConsumeQueueUntilContextDone(ctx, queueName, handler, c.Logger); err != nil && ctx.Err() == nil {
		c.Logger.ErrorContext(ctx, "entitlement consumer stopped", "error", err)
	}
}

func ensurePersonalProfileForRegisteredAccount(ctx context.Context, c *container.Container, data json.RawMessage) error {
	var registered struct {
		AccountId string `json:"accountId"`
	}
	if err := json.Unmarshal(data, &registered); err != nil {
		return fmt.Errorf("%w: %v", platformevents.ErrPoisonMessage, err)
	}
	accountId, err := uuid.Parse(registered.AccountId)
	if err != nil {
		return fmt.Errorf("%w: account id: %v", platformevents.ErrPoisonMessage, err)
	}
	if _, _, err = usersservices.EnsurePersonalProfile(ctx, c, accountId); errors.Is(err, userserrors.ErrAccountUnavailable) {
		return nil
	}
	return err
}
