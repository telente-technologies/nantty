package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/automationRules/repositories"
	"nantty/modules/moderation/src/modules/automationRules/services"
	reportservices "nantty/modules/moderation/src/modules/contentReports/services"
	strikeservices "nantty/modules/moderation/src/modules/strikes/services"
	platformevents "nantty/platform/events"
)

type triggerData struct {
	ReporterId        string   `json:"reporterId"`
	TargetType        string   `json:"targetType"`
	TargetId          string   `json:"targetId"`
	ReportedUserId    string   `json:"reportedUserId"`
	Reason            string   `json:"reason"`
	StoreId           string   `json:"storeId"`
	OwnerAccountId    string   `json:"ownerAccountId"`
	CountryCode       string   `json:"countryCode"`
	Currency          string   `json:"currency"`
	ApplicationId     string   `json:"applicationId"`
	AccountId         string   `json:"accountId"`
	Color             string   `json:"color"`
	SenderId          string   `json:"senderId"`
	ConversationId    string   `json:"conversationId"`
	Kind              string   `json:"kind"`
	RecipientIds      []string `json:"recipientIds"`
	IsNewConversation bool     `json:"isNewConversation"`
}

func NewEngine(c *container.Container) services.Engine {
	return services.Engine{Store: repositories.EntStore{Container: c}, Actions: services.ContentActionRunner{Container: c}, Now: func() time.Time { return c.Now() }, Logger: c.Logger}
}

func AutomationTriggerHandler(c *container.Container) platformevents.MessageHandler {
	engine := NewEngine(c)
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: automation trigger is not an envelope", platformevents.ErrPoisonMessage)
		}
		var data triggerData
		if _, watched := services.FindCatalogEvent(envelope.Type); !watched {
			return nil
		}
		if err := json.Unmarshal(envelope.Data, &data); err != nil {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, envelope.Type)
		}
		event, ok := BuildEvent(ctx, c, envelope.Type, data)
		if !ok {
			return nil
		}
		event.SourceEventId = envelope.Id
		return engine.HandleEvent(ctx, event)
	}
}

func BuildEvent(ctx context.Context, c *container.Container, eventType string, data triggerData) (services.Event, bool) {
	switch eventType {
	case services.EventReportCreated:
		reason, _ := reportservices.NormalizeReason(data.Reason)
		if data.TargetType == "" || data.TargetId == "" {
			return services.Event{}, false
		}
		return services.Event{Name: eventType, SubjectKey: data.TargetType + ":" + data.TargetId, SubjectLabel: data.TargetType + " " + data.TargetId, Data: map[string]any{
			"targetType": data.TargetType, "targetId": data.TargetId, "targetOwnerId": data.ReportedUserId, "reporterId": data.ReporterId, "reason": reason,
		}}, true
	case services.EventStoreCreated:
		payload := map[string]any{"storeId": data.StoreId, "ownerId": data.OwnerAccountId, "countryCode": data.CountryCode, "currency": data.Currency}
		describeAccountRisk(ctx, c, data.OwnerAccountId, payload)
		return services.Event{Name: eventType, SubjectKey: "user:" + data.OwnerAccountId, SubjectLabel: "Store " + data.StoreId, Data: payload}, data.OwnerAccountId != ""
	case services.EventVerificationSubmitted:
		payload := map[string]any{"applicationId": data.ApplicationId, "userId": data.AccountId, "color": data.Color}
		describeAccountRisk(ctx, c, data.AccountId, payload)
		return services.Event{Name: eventType, SubjectKey: "user:" + data.AccountId, SubjectLabel: "Application " + data.ApplicationId, Data: payload}, data.AccountId != ""
	case services.EventMessageSent:
		return services.Event{Name: eventType, SubjectKey: "user:" + data.SenderId, SubjectLabel: "Message in " + data.ConversationId, Data: map[string]any{
			"senderId": data.SenderId, "conversationId": data.ConversationId, "messageKind": data.Kind, "recipientCount": float64(len(data.RecipientIds)), "isNewConversation": data.IsNewConversation,
		}}, data.SenderId != ""
	}
	return services.Event{}, false
}

func describeAccountRisk(ctx context.Context, c *container.Container, accountId string, payload map[string]any) {
	identifier, err := uuid.Parse(accountId)
	if err != nil {
		return
	}
	payload["emailVerified"] = false
	now := c.Now()
	if counts, err := strikeservices.ActiveCounts(ctx, c.Client, now, []uuid.UUID{identifier}); err == nil {
		payload["moderationStrikes"] = float64(counts[identifier].ActiveStrikes)
	}
	summaries, err := c.Users.Summaries(ctx, []uuid.UUID{identifier})
	if err != nil {
		c.Logger.WarnContext(ctx, "automation could not read the account summary", "error", err.Error())
		return
	}
	summary := summaries[accountId]
	if joined, isText := summary["joinedAt"].(string); isText {
		if parsed, err := time.Parse(time.RFC3339, joined); err == nil {
			payload["accountAgeDays"] = float64(int(now.Sub(parsed).Hours() / 24))
		}
	}
	for source, target := range map[string]string{"status": "accountStatus", "riskLevel": "riskLevel"} {
		if value, isText := summary[source].(string); isText {
			payload[target] = value
		}
	}
	if emailVerified, isBool := summary["emailVerified"].(bool); isBool {
		payload["emailVerified"] = emailVerified
	}
	if summary != nil {
		verification, _ := summary["verification"].(map[string]any)
		payload["isVerified"] = verification != nil
	}
}
