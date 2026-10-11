package interfaces

import "context"

type PayoutIdentityRequest struct {
	UserId        string
	Email         string
	FirstName     string
	LastName      string
	Country       string
	Bvn           string
	BankCode      string
	AccountNumber string
	SubjectId     string
}

type PayoutIdentityVerifier interface {
	RequestPayoutIdentityCheck(ctx context.Context, request PayoutIdentityRequest) (string, error)
}
