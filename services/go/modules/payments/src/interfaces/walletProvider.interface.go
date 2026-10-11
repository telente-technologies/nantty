package interfaces

import (
	"context"
	"time"
)

type WalletOwner struct {
	UserId      string
	AccountName string
	AliasEmail  string
	MobileNo    string
	Country     string
}

type ProviderWallet struct {
	AccountRef string
	BarterId   string
	Nuban      string
	BankCode   string
	BankName   string
	Currency   string
	Status     string
}

type FundingAccount struct {
	AccountNumber string
	BankCode      string
	BankName      string
	Currency      string
}

type WalletLine struct {
	Reference   string
	Direction   string
	AmountMinor int64
	Currency    string
	Narration   string
	OccurredAt  time.Time
}

type WalletMove struct {
	FromAccountRef      string
	FromPlatformBalance bool
	ToBarterId          string
	ToPlatformBalance   bool
	AmountMinor         int64
	Currency            string
	Reference           string
	Narration           string
}

type FundingReversal struct {
	FundingReference string
	AccountRef       string
	AmountMinor      int64
	Currency         string
	Outcome          ProviderOutcome
}

type WalletProvider interface {
	CreateWallet(ctx context.Context, owner WalletOwner) (ProviderWallet, error)
	FetchWallet(ctx context.Context, accountRef string) (ProviderWallet, error)
	FindWalletByAccountNumber(ctx context.Context, accountNumber string) (ProviderWallet, bool, error)
	ListFundingAccounts(ctx context.Context, accountRef, currency string) ([]FundingAccount, error)
	ReadWalletBalance(ctx context.Context, accountRef, currency string) (ProviderBalance, error)
	ListWalletTransactions(ctx context.Context, accountRef string, from, to time.Time) ([]WalletLine, error)
	MoveBetweenWallets(ctx context.Context, move WalletMove) (TransferResult, error)
	ReverseFunding(ctx context.Context, fundingReference, currency string) (RefundResult, error)
	ListFundingReversals(ctx context.Context, from, to time.Time) ([]FundingReversal, error)
	CloseWallet(ctx context.Context, accountRef string) error
}
