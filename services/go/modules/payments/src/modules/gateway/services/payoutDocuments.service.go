package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/connectedaccount"
	"nantty/modules/payments/src/generated/ent/payoutonboarding"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

const documentLinkReuseMargin = time.Minute

var ErrDocumentSessionUnknown = httpserver.NewApiError(http.StatusNotFound, "DOCUMENT_SESSION_NOT_FOUND", "Verification session was not found.")

type PayoutDocumentLink struct {
	Url       string
	ReturnUrl string
	ExpiresAt time.Time
}

func currentDocumentStatus(onboarding *ent.PayoutOnboarding, now time.Time) string {
	status := string(onboarding.DocumentStatus)
	if status == "link_issued" && (onboarding.DocumentLinkExpiresAt == nil || !onboarding.DocumentLinkExpiresAt.After(now)) {
		return "not_started"
	}
	return status
}

func (gateway *PaymentGateway) CreatePayoutVerificationLink(ctx context.Context, userId string) (PayoutDocumentLink, error) {
	database := gateway.Container.Resources.Database
	account, err := gateway.FindConnectedAccountRowForUser(ctx, database, userId)
	if err != nil || models.MapPayoutAccountStatus(string(account.Status), string(account.VerificationStatus)) != "documentsRequired" {
		return PayoutDocumentLink{}, ErrDocumentLinkNotReady
	}
	onboarding, err := gateway.Container.Client(database).PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return PayoutDocumentLink{}, ErrOnboardingStepOrder
	}
	if err != nil {
		return PayoutDocumentLink{}, err
	}
	returnUrl := gateway.Container.Settings.OnboardingReturnUrl
	now := gateway.Container.Now().UTC()
	if onboarding.DocumentStatus == payoutonboarding.DocumentStatusLinkIssued && onboarding.DocumentLinkExpiresAt != nil && onboarding.DocumentLinkExpiresAt.After(now.Add(documentLinkReuseMargin)) {
		return PayoutDocumentLink{Url: onboarding.DocumentLinkURL, ReturnUrl: returnUrl, ExpiresAt: *onboarding.DocumentLinkExpiresAt}, nil
	}
	verifier := gateway.Container.Documents
	if verifier == nil {
		return PayoutDocumentLink{}, ErrDocumentLinkUnavailable
	}
	session, err := verifier.CreateDocumentVerificationSession(ctx, interfaces.DocumentVerificationRequest{
		UserId: userId, LegalName: onboarding.LegalName, Reference: "payout-documents:" + onboarding.ID.String(), ReturnUrl: returnUrl,
	})
	if err != nil || session.Url == "" || session.SessionId == "" || !session.ExpiresAt.After(now) {
		gateway.Container.Resources.Logger.WarnContext(ctx, "document verification session could not be created", "userId", userId, "error", err)
		return PayoutDocumentLink{}, ErrDocumentLinkUnavailable
	}
	if err := onboarding.Update().SetDocumentStatus(payoutonboarding.DocumentStatusLinkIssued).SetDocumentSessionID(session.SessionId).
		SetDocumentLinkURL(session.Url).SetDocumentLinkExpiresAt(session.ExpiresAt.UTC()).Exec(ctx); err != nil {
		return PayoutDocumentLink{}, err
	}
	return PayoutDocumentLink{Url: session.Url, ReturnUrl: returnUrl, ExpiresAt: session.ExpiresAt.UTC()}, nil
}

func (gateway *PaymentGateway) HandleDocumentVerificationWebhook(ctx context.Context, rawBody []byte, headers http.Header) error {
	verifier := gateway.Container.Documents
	if verifier == nil {
		return httpserver.ErrNotFound
	}
	event, err := verifier.VerifyDocumentVerificationWebhook(rawBody, headers)
	if err != nil {
		return httpserver.NewApiError(http.StatusUnauthorized, "INVALID_WEBHOOK_SIGNATURE", "The webhook signature is invalid.")
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.applyDocumentVerificationEvent(ctx, transaction, event)
	})
}

func (gateway *PaymentGateway) applyDocumentVerificationEvent(ctx context.Context, transaction *sql.Tx, event interfaces.DocumentVerificationEvent) error {
	client := gateway.Container.Client(transaction)
	if event.SessionId == "" {
		return ErrDocumentSessionUnknown
	}
	onboarding, err := client.PayoutOnboarding.Query().Where(payoutonboarding.DocumentSessionID(event.SessionId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		gateway.Container.Resources.Logger.WarnContext(ctx, "document verification event for an unknown or replaced session", "sessionId", event.SessionId)
		return nil
	}
	if err != nil {
		return err
	}
	account, err := gateway.FindConnectedAccountRowForUser(ctx, transaction, onboarding.UserID)
	if err != nil {
		return err
	}
	locked, err := client.ConnectedAccount.Query().Where(connectedaccount.ID(account.ID)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	now := gateway.Container.Now().UTC()
	documentStatus, verification := payoutonboarding.DocumentStatusInReview, connectedaccount.VerificationStatusUnderReview
	switch event.Outcome {
	case interfaces.DocumentVerificationSubmitted:
		if onboarding.DocumentStatus == payoutonboarding.DocumentStatusApproved || onboarding.DocumentStatus == payoutonboarding.DocumentStatusRejected {
			return nil
		}
	case interfaces.DocumentVerificationApproved:
		documentStatus, verification = payoutonboarding.DocumentStatusApproved, connectedaccount.VerificationStatusInProgress
	case interfaces.DocumentVerificationRejected:
		documentStatus, verification = payoutonboarding.DocumentStatusRejected, connectedaccount.VerificationStatusDocumentsRequired
	default:
		return errors.New("unknown document verification outcome " + event.Outcome)
	}
	if onboarding.DocumentStatus == documentStatus {
		return nil
	}
	if err := onboarding.Update().SetDocumentStatus(documentStatus).SetDocumentRejectionReason(truncateReason(event.Reason)).
		SetDocumentLinkURL("").ClearDocumentLinkExpiresAt().Exec(ctx); err != nil {
		return err
	}
	if locked.VerificationStatus == connectedaccount.VerificationStatusVerified {
		return nil
	}
	if err := locked.Update().SetVerificationStatus(verification).SetVerificationStatusChangedAt(now).AddVersion(1).Exec(ctx); err != nil {
		return err
	}
	if documentStatus == payoutonboarding.DocumentStatusApproved {
		if err := gateway.applyPayoutAccountStatusInTransaction(ctx, transaction, locked.ID); err != nil {
			return err
		}
	}
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.documents"+map[payoutonboarding.DocumentStatus]string{
		payoutonboarding.DocumentStatusInReview: "Submitted", payoutonboarding.DocumentStatusApproved: "Approved", payoutonboarding.DocumentStatusRejected: "Rejected",
	}[documentStatus], locked.ID.String(), now, map[string]any{"userId": onboarding.UserID, "payoutAccountId": locked.ID.String(), "documentStatus": string(documentStatus)})
}
