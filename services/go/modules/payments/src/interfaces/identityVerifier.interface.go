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

type IdentityVerifier interface {
	ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error)
	ListBanks(ctx context.Context, countryCode string) ([]Bank, error)
	RequestPayoutIdentityCheck(ctx context.Context, request PayoutIdentityRequest) (string, error)
}

type CountryIdentityVerifier interface {
	ResolveBankAccountNameInCountry(ctx context.Context, countryCode, bankCode, accountNumber string) (string, error)
}

type BvnConsentRequest struct {
	Reference   string
	Bvn         string
	FirstName   string
	LastName    string
	RedirectUrl string
}

type ConsentSession struct {
	Reference  string
	ConsentUrl string
}

type BvnIdentity struct {
	Reference   string
	Status      string
	FirstName   string
	MiddleName  string
	LastName    string
	DateOfBirth string
	Phone       string
	Watchlisted bool
}

type BvnConsentVerifier interface {
	StartBvnConsent(ctx context.Context, request BvnConsentRequest) (ConsentSession, error)
	ReadBvnResult(ctx context.Context, reference string) (BvnIdentity, error)
}
