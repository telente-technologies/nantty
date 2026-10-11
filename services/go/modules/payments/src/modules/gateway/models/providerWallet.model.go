package models

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	MovementFeeSweep           = "feeSweep"
	MovementEscrowFundIn       = "escrowFundIn"
	MovementEscrowRelease      = "escrowRelease"
	MovementEscrowCommission   = "escrowCommission"
	MovementClawback           = "clawback"
	MovementClawbackTopUp      = "clawbackTopUp"
	MovementWalletPayment      = "walletPayment"
	MovementChargebackRecovery = "chargebackRecovery"
	MovementCreatorPayout      = "creatorPayout"
)

var MovementReferencePrefixByKind = map[string]string{
	MovementFeeSweep: "sweep-", MovementEscrowFundIn: "esc-in-", MovementEscrowRelease: "rel-", MovementEscrowCommission: "com-",
	MovementClawback: "claw-", MovementClawbackTopUp: "clawtop-", MovementWalletPayment: "walpay-", MovementChargebackRecovery: "cbrec-",
	MovementCreatorPayout: "crpay-", "directSale": "dsale-", "walletCredit": "wcred-",
}

func NewMovementReference(kind string) string {
	return MovementReferencePrefixByKind[kind] + strings.ReplaceAll(uuid.Must(uuid.NewV7()).String(), "-", "")
}

type MovementRequest struct {
	Reference   string
	Kind        string
	SubjectId   string
	UserId      string
	FromUserId  string
	ToUserId    string
	ToPlatform  bool
	AmountMinor int64
	Currency    string
	BlockedOn   string
	NotBefore   *time.Time
	Metadata    map[string]any
}

type FinishedMovement struct {
	MovementId    uuid.UUID
	Reference     string
	Kind          string
	SubjectId     string
	UserId        string
	FromWalletRef string
	FromUserId    string
	ToWalletRef   string
	ToUserId      string
	ToPlatform    bool
	AmountMinor   int64
	Currency      string
	FailureReason string
	Metadata      map[string]any
	FinishedAt    time.Time
}

func (movement FinishedMovement) MetadataString(key string) string {
	value, _ := movement.Metadata[key].(string)
	return value
}

func (movement FinishedMovement) MetadataAmount(key string) int64 {
	switch value := movement.Metadata[key].(type) {
	case json.Number:
		parsed, _ := value.Int64()
		return parsed
	case float64:
		return int64(value)
	case int64:
		return value
	case int:
		return int64(value)
	}
	return 0
}

type MovementOutcomeHandler interface {
	HandleMovementSucceeded(ctx context.Context, transaction *sql.Tx, movement FinishedMovement) error
	HandleMovementFailed(ctx context.Context, transaction *sql.Tx, movement FinishedMovement) error
}

type ProviderWalletView struct {
	Provider       string              `json:"provider"`
	Currency       string              `json:"currency"`
	Status         string              `json:"status"`
	AccountName    string              `json:"accountName"`
	AccountNumber  string              `json:"accountNumber"`
	BankName       string              `json:"bankName"`
	BankCode       string              `json:"bankCode"`
	FundingNumbers []FundingNumberView `json:"fundingNumbers"`
	CreatedAt      time.Time           `json:"createdAt"`
	FrozenAt       *time.Time          `json:"frozenAt"`
}

type FundingNumberView struct {
	AccountNumber string `json:"accountNumber"`
	BankName      string `json:"bankName"`
}

type WalletBalancesView struct {
	Currency          string `json:"currency"`
	AvailableMinor    int64  `json:"availableMinor"`
	DepositHoldMinor  int64  `json:"depositHoldMinor"`
	EscrowLockedMinor int64  `json:"escrowLockedMinor"`
	OutgoingMinor     int64  `json:"outgoingMinor"`
	ReservedMinor     int64  `json:"reservedPayoutMinor"`
	DebtMinor         int64  `json:"debtMinor"`
}

type WalletPaymentRequest struct {
	UserId         string
	Reference      string
	IdempotencyKey string
}
