package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent/paymentintent"

	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type sealedPayoutDestination struct {
	BankCode        string `json:"bankCode"`
	AccountNumber   string `json:"accountNumber"`
	BeneficiaryName string `json:"beneficiaryName"`
	BranchCode      string `json:"branchCode,omitempty"`
}

func (gateway *PaymentGateway) readUserWalletBalance(ctx context.Context, userId, currency string) (int64, error) {
	wallet, err := gateway.FindActiveProviderWallet(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return 0, err
	}
	provider, err := gateway.Container.Wallets(wallet.Provider)
	if err != nil {
		return 0, err
	}
	balance, err := provider.ReadWalletBalance(ctx, wallet.AccountRef, currency)
	if err != nil {
		if isDefinitiveProviderRejection(err) {
			gateway.FreezeProviderWallet(ctx, userId, "the provider no longer recognises this wallet")
			return 0, ErrProviderWalletFrozen
		}
		return 0, convertProviderError(err)
	}
	return balance.AvailableMinor, nil
}

func (gateway *PaymentGateway) prepareWalletPayoutInTransaction(ctx context.Context, transaction *sql.Tx, instruction models.SellerPayoutInstruction) (PayoutTransferStatus, error) {
	if instruction.BankCode == "" || len(instruction.AccountNumber) < 6 {
		return PayoutTransferStatus{}, errors.New("a wallet payout needs the destination bank account")
	}
	wallet, err := gateway.FindActiveProviderWallet(ctx, transaction, instruction.BeneficiaryUserId)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	sealed, err := gateway.sealSensitivePayload(sealedPayoutDestination{BankCode: instruction.BankCode, AccountNumber: instruction.AccountNumber, BeneficiaryName: wallet.AccountName})
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	transfer, err := gateway.Container.Client(transaction).PayoutTransfer.Create().
		SetReference(instruction.Reference).SetPurpose(instruction.Purpose).SetSubjectID(instruction.SubjectId).SetProvider(wallet.Provider).
		SetKind(payouttransfer.KindPayout).SetBeneficiaryUserID(instruction.BeneficiaryUserId).SetProviderDestinationID(flutterwaveBankLabel(instruction.BankCode, instruction.AccountNumber)).
		SetAmountMinor(instruction.AmountMinor).SetFeeMinor(instruction.FeeMinor).SetCurrency(instruction.Currency).SetBankCode(instruction.BankCode).
		SetDestinationLast4(lastFour(instruction.AccountNumber)).SetSourceWalletRef(wallet.AccountRef).SetSealedDestination(sealed).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return PayoutTransferStatus{Reference: transfer.Reference, Status: string(transfer.Status)}, nil
}

func flutterwaveBankLabel(bankCode, accountNumber string) string {
	return "bank:" + bankCode + ":" + lastFour(accountNumber)
}

func (gateway *PaymentGateway) completeWalletPayoutRequest(ctx context.Context, transfer *ent.PayoutTransfer, request *interfaces.TransferRequest) (string, error) {
	var destination sealedPayoutDestination
	if err := gateway.openSensitivePayload(*transfer.SealedDestination, &destination); err != nil {
		return "", err
	}
	request.BankCode, request.AccountNumber, request.BeneficiaryName, request.BranchCode = destination.BankCode, destination.AccountNumber, destination.BeneficiaryName, destination.BranchCode
	if transfer.SourceWalletRef == "" {
		return "", nil
	}
	provider, err := gateway.Container.Wallets(transfer.Provider)
	if err != nil {
		return "", err
	}
	balance, err := provider.ReadWalletBalance(ctx, transfer.SourceWalletRef, transfer.Currency)
	if err != nil {
		if isDefinitiveProviderRejection(err) {
			gateway.FreezeProviderWallet(ctx, transfer.BeneficiaryUserID, "the provider no longer recognises this wallet")
			return "the wallet no longer exists at the provider", nil
		}
		return "", convertProviderError(err)
	}
	if balance.AvailableMinor < transfer.AmountMinor+transfer.FeeMinor {
		gateway.FreezeProviderWallet(ctx, transfer.BeneficiaryUserID, "the provider balance is below the withdrawal")
		gateway.OpenReconciliationCase(ctx, "walletBelowLedgerOnDebit", transfer.SourceWalletRef, transfer.Reference, transfer.AmountMinor+transfer.FeeMinor, balance.AvailableMinor, transfer.Currency, "a withdrawal found less money in the wallet than the ledger expects")
		return "the wallet holds less than this withdrawal", nil
	}
	return "", nil
}

func (gateway *PaymentGateway) IsPaymentSettled(ctx context.Context, executor databases.ExecutorQuerier, intentId uuid.UUID) (bool, error) {
	return gateway.Container.Client(executor).PaymentIntent.Query().Where(paymentintent.ID(intentId), paymentintent.ProviderSettledAtNotNil()).Exist(ctx)
}

func (gateway *PaymentGateway) PrepareDirectSellerPayoutInTransaction(ctx context.Context, transaction *sql.Tx, instruction models.SellerPayoutInstruction) (PayoutTransferStatus, error) {
	bank, err := gateway.latestPayeeBankAccount(ctx, instruction.BeneficiaryUserId)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	sealed, err := gateway.sealSensitivePayload(sealedPayoutDestination{BankCode: bank.BankCode, AccountNumber: bank.AccountNumber, BeneficiaryName: bank.AccountName})
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	transfer, err := gateway.Container.Client(transaction).PayoutTransfer.Create().
		SetReference(instruction.Reference).SetPurpose(instruction.Purpose).SetSubjectID(instruction.SubjectId).SetProvider(gateway.walletProviderName()).
		SetKind(payouttransfer.KindPayout).SetBeneficiaryUserID(instruction.BeneficiaryUserId).SetProviderDestinationID(flutterwaveBankLabel(bank.BankCode, bank.AccountNumber)).
		SetAmountMinor(instruction.AmountMinor).SetFeeMinor(instruction.FeeMinor).SetCurrency(instruction.Currency).SetBankCode(bank.BankCode).
		SetDestinationLast4(lastFour(bank.AccountNumber)).SetSealedDestination(sealed).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return PayoutTransferStatus{Reference: transfer.Reference, Status: string(transfer.Status)}, nil
}
