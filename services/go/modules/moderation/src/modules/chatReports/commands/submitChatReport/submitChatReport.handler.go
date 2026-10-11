package submitchatreport

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/chatreport"
	"zudomart/modules/moderation/src/integrations"
	chatevents "zudomart/modules/moderation/src/modules/chatReports/events"
	"zudomart/modules/moderation/src/modules/chatReports/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reporter, err := uuid.Parse(command.ReporterId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	if command.IdempotencyKey != "" {
		if existing, err := handler.findByKey(ctx, reporter, command.IdempotencyKey); err != nil || existing != nil {
			if err != nil {
				return Result{}, err
			}
			return Result{Id: existing.ID.String(), Status: "received", Priority: string(existing.Priority), Replayed: true}, nil
		}
	}
	reportedUser, evidence, err := handler.validate(command)
	if err != nil {
		return Result{}, err
	}
	if err := handler.enforceRateLimit(ctx, reporter); err != nil {
		return Result{}, err
	}
	if err := handler.requireReportable(ctx, command, reporter); err != nil {
		return Result{}, err
	}
	retentionDays, _, err := services.LoadRetentionSettings(ctx, handler.Container.Client)
	if err != nil {
		return Result{}, err
	}
	now := handler.Container.Now()
	priority := services.PriorityForReason(command.Reason)
	computedHash := services.HashEvidenceExactlyAsSent(command.Evidence)
	var created *ent.ChatReport
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		create := tx.ChatReport.Create().SetReporterID(reporter).SetTargetType(chatreport.TargetType(command.TargetType)).SetTargetID(command.TargetId).SetConversationID(command.ConversationId).
			SetReason(command.Reason).SetDetails(command.Details).SetBlockReportedUser(command.BlockReportedUser).SetEvidenceSelection(command.EvidenceSelection).SetEvidenceHash(command.EvidenceHash).
			SetEvidenceHashVerified(command.EvidenceHash != "" && command.EvidenceHash == computedHash).SetPriority(chatreport.Priority(priority)).SetSLADueAt(now.Add(services.SlaFor(priority))).SetEvidenceRetainedUntil(services.RetainedUntil(now, retentionDays))
		if len(evidence) > 0 {
			create.SetEvidence(command.Evidence)
		}
		if reportedUser != nil {
			create.SetReportedUserID(*reportedUser)
		}
		if command.IdempotencyKey != "" {
			create.SetIdempotencyKey(command.IdempotencyKey)
		}
		var err error
		if created, err = create.Save(ctx); err != nil {
			return err
		}
		var reported *string
		if reportedUser != nil {
			text := reportedUser.String()
			reported = &text
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, chatevents.ChatReportReceivedType, created.ID.String(), now, chatevents.ReceivedData{
			ReportId: created.ID.String(), ReporterId: reporter.String(), TargetType: command.TargetType, ReportedUserId: reported, ConversationId: command.ConversationId, Reason: command.Reason, Priority: priority, BlockReportedUser: command.BlockReportedUser,
		})
	})
	if ent.IsConstraintError(err) && command.IdempotencyKey != "" {
		existing, lookupErr := handler.findByKey(ctx, reporter, command.IdempotencyKey)
		if lookupErr == nil && existing != nil {
			return Result{Id: existing.ID.String(), Status: "received", Priority: string(existing.Priority), Replayed: true}, nil
		}
	}
	if err != nil {
		return Result{}, err
	}
	return Result{Id: created.ID.String(), Status: "received", Priority: priority}, nil
}

func (handler Handler) findByKey(ctx context.Context, reporter uuid.UUID, key string) (*ent.ChatReport, error) {
	row, err := handler.Container.Client.ChatReport.Query().Where(chatreport.ReporterID(reporter), chatreport.IdempotencyKey(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (handler Handler) enforceRateLimit(ctx context.Context, reporter uuid.UUID) error {
	recent, err := handler.Container.Client.ChatReport.Query().Where(chatreport.ReporterID(reporter), chatreport.CreatedAtGT(handler.Container.Now().Add(-time.Hour))).Count(ctx)
	if err != nil {
		return err
	}
	if recent >= handler.Container.Settings.ReportsPerHour {
		return httpserver.NewApiError(http.StatusTooManyRequests, "REPORT_RATE_LIMITED", "You have sent a lot of reports. Try again in a little while.")
	}
	return nil
}

func (handler Handler) validate(command Command) (*uuid.UUID, []services.EvidenceMessage, error) {
	invalid := func(path, message string) error {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
	}
	if !slices.Contains([]string{"user", "message", "conversation", "group"}, command.TargetType) {
		return nil, nil, invalid("targetType", "must be user, message, conversation or group")
	}
	if !slices.Contains(services.ChatReportReasons, command.Reason) {
		return nil, nil, invalid("reason", "is not a known reason")
	}
	if strings.TrimSpace(command.TargetId) == "" || len(command.TargetId) > 128 || len(command.ConversationId) > 128 || len(command.Details) > 500 {
		return nil, nil, invalid("targetId", "is required; details are at most 500 characters")
	}
	if command.Reason == "other" && strings.TrimSpace(command.Details) == "" {
		return nil, nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "DETAILS_REQUIRED", "Tell us what happened.")
	}
	evidence, err := services.ParseEvidence(command.Evidence)
	if err != nil || len(evidence) > services.MaximumEvidenceMessages {
		return nil, nil, invalid("evidence", "must be a list of at most 100 messages")
	}
	if slices.Contains(services.EvidenceRequiredTargets, command.TargetType) && len(evidence) == 0 {
		return nil, nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "EVIDENCE_REQUIRED", "Attach the messages you want us to review.")
	}
	for _, message := range evidence {
		if len(message.Text) > 4000 || message.MessageId == "" || message.SenderId == "" {
			return nil, nil, invalid("evidence", "has a message that is empty or too long")
		}
	}
	if command.ReportedUserId == "" {
		if command.TargetType == "user" {
			return nil, nil, invalid("reportedUserId", "is required when reporting a user")
		}
		return nil, evidence, nil
	}
	reported, err := uuid.Parse(command.ReportedUserId)
	if err != nil {
		return nil, nil, invalid("reportedUserId", "must be a user id")
	}
	return &reported, evidence, nil
}

func (handler Handler) requireReportable(ctx context.Context, command Command, reporter uuid.UUID) error {
	if command.ConversationId == "" {
		if slices.Contains(services.EvidenceRequiredTargets, command.TargetType) {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "conversationId", Message: "is required for this report"}})
		}
		return nil
	}
	request := integrations.ChatReportabilityRequest{ConversationId: command.ConversationId, ReporterId: reporter.String(), ReportedUserId: command.ReportedUserId}
	if command.TargetType == "message" {
		request.MessageId = command.TargetId
	}
	return handler.Container.ChatReportability.RequireReportable(ctx, request)
}
