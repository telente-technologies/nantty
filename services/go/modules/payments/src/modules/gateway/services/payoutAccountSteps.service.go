package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/connectedaccount"
	"nantty/modules/payments/src/generated/ent/connectedaccountjob"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"

	"github.com/google/uuid"
)

func (gateway *PaymentGateway) executeConnectedAccountStep(ctx context.Context, job *ent.ConnectedAccountJob) (any, error) {
	account, err := gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, job.UserID)
	if err != nil {
		return nil, err
	}
	provider, err := gateway.Container.Payees(account.Provider)
	if err != nil {
		return nil, err
	}
	if job.Step == connectedaccountjob.StepRefreshStatus {
		return nil, gateway.recomputePayoutAccountStatus(ctx, account.ID)
	}
	var bank interfaces.PayeeBankAccount
	if job.SealedPayload == nil || gateway.openSensitivePayload(*job.SealedPayload, &bank) != nil || bank.AccountNumber == "" {
		return nil, errors.New("the saved bank details could not be read")
	}
	bank.UserId = account.UserID
	var linked bool
	if err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		linked, err = gateway.claimSettlementAccountInTransaction(ctx, transaction, account, bank)
		return err
	}); err != nil {
		return nil, err
	}
	if linked {
		return nil, ErrBankAccountAlreadyLinked
	}
	switch job.Step {
	case connectedaccountjob.StepCreateRecipient:
		code, found, err := provider.FindTransferRecipient(ctx, bank)
		if err != nil {
			return nil, fmt.Errorf("recipient lookup failed, not creating to avoid a duplicate: %w", err)
		}
		if !found {
			if code, err = provider.CreateTransferRecipient(ctx, bank); err != nil {
				return nil, err
			}
		}
		return nil, gateway.storePayeeCode(ctx, account.ID, func(update *ent.ConnectedAccountUpdateOne) {
			update.SetRecipientCode(code).SetBankCode(bank.BankCode).SetAccountLast4(lastFour(bank.AccountNumber)).SetAccountName(bank.AccountName)
		})
	case connectedaccountjob.StepCreateSettlementSubaccount, connectedaccountjob.StepCreateEscrowSubaccount:
		manual := job.Step == connectedaccountjob.StepCreateEscrowSubaccount
		request := interfaces.SettlementSubaccountRequest{PayeeBankAccount: bank, BusinessName: bank.AccountName, ManualSettlement: manual}
		code, found, err := provider.FindSettlementSubaccount(ctx, request)
		if err != nil {
			return nil, fmt.Errorf("subaccount lookup failed, not creating to avoid a duplicate: %w", err)
		}
		if !found {
			if code, err = provider.CreateSettlementSubaccount(ctx, request); err != nil {
				return nil, err
			}
		}
		return nil, gateway.storePayeeCode(ctx, account.ID, func(update *ent.ConnectedAccountUpdateOne) {
			if manual {
				update.SetEscrowSubaccountCode(code)
			} else {
				update.SetSettlementSubaccountCode(code)
			}
		})
	}
	return nil, fmt.Errorf("unknown payout account step %q", job.Step)
}

func (gateway *PaymentGateway) storePayeeCode(ctx context.Context, accountId uuid.UUID, apply func(*ent.ConnectedAccountUpdateOne)) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		locked, err := client.ConnectedAccount.Query().Where(connectedaccount.ID(accountId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		update := locked.Update().AddVersion(1)
		apply(update)
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return gateway.applyPayoutAccountStatusInTransaction(ctx, transaction, locked.ID)
	})
}

func (gateway *PaymentGateway) recomputePayoutAccountStatus(ctx context.Context, accountId uuid.UUID) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.applyPayoutAccountStatusInTransaction(ctx, transaction, accountId)
	})
}

func PayoutAccountComplete(account *ent.ConnectedAccount, escrowSubaccountRequired bool) bool {
	if account.RecipientCode == "" {
		return false
	}
	if slices.Contains(account.Roles, constants.ConnectedAccountRoleSeller) && account.SettlementSubaccountCode == "" {
		return false
	}
	return !escrowSubaccountRequired || !slices.Contains(account.Roles, constants.ConnectedAccountRoleSeller) || account.EscrowSubaccountCode != ""
}

func (gateway *PaymentGateway) enqueueSubaccountStepsFromLatestBankInTransaction(ctx context.Context, transaction *sql.Tx, userId string) error {
	latest, err := gateway.Container.Client(transaction).ConnectedAccountJob.Query().
		Where(connectedaccountjob.UserID(userId), connectedaccountjob.StepEQ(connectedaccountjob.StepCreateRecipient)).
		Order(ent.Desc(connectedaccountjob.FieldVersion)).First(ctx)
	if ent.IsNotFound(err) || (err == nil && latest.SealedPayload == nil) {
		return nil
	}
	if err != nil {
		return err
	}
	var bank interfaces.PayeeBankAccount
	if err := gateway.openSensitivePayload(*latest.SealedPayload, &bank); err != nil {
		return err
	}
	return gateway.enqueueSellerSubaccountJobsInTransaction(ctx, transaction, userId, bank)
}

func (gateway *PaymentGateway) enqueueSellerSubaccountJobsInTransaction(ctx context.Context, transaction *sql.Tx, userId string, bank interfaces.PayeeBankAccount) error {
	if _, err := gateway.enqueueConnectedAccountStepInTransaction(ctx, transaction, userId, models.JobStepCreateSettlementSubaccount, bank); err != nil {
		return err
	}
	if gateway.Container.Settings.EscrowMode == "e1" {
		_, err := gateway.enqueueConnectedAccountStepInTransaction(ctx, transaction, userId, models.JobStepCreateEscrowSubaccount, bank)
		return err
	}
	return nil
}
