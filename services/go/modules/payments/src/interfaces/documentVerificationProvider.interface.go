package interfaces

import (
	"context"
	"net/http"
	"time"
)

type DocumentVerificationRequest struct {
	UserId    string
	LegalName string
	Reference string
	ReturnUrl string
}

type DocumentVerificationSession struct {
	SessionId string
	Url       string
	ExpiresAt time.Time
}

const (
	DocumentVerificationSubmitted = "submitted"
	DocumentVerificationApproved  = "approved"
	DocumentVerificationRejected  = "rejected"
)

type DocumentVerificationEvent struct {
	SessionId string
	Outcome   string
	Reason    string
}

type DocumentVerificationProvider interface {
	CreateDocumentVerificationSession(ctx context.Context, request DocumentVerificationRequest) (DocumentVerificationSession, error)
	VerifyDocumentVerificationWebhook(rawBody []byte, headers http.Header) (DocumentVerificationEvent, error)
}
