package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"nantty/modules/ledger/src/databases"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/payments/src/generated/ent/customervalidation"
	"nantty/modules/payments/src/generated/ent/verificationlevelrecord"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

var (
	ErrVerificationRequired    = httpserver.NewApiError(http.StatusForbidden, "VERIFICATION_REQUIRED", "Verify your payout details to continue. Nothing you have earned is lost while you verify.")
	ErrIdentityRequired        = httpserver.NewApiError(http.StatusForbidden, "IDENTITY_VERIFICATION_REQUIRED", "Finish the identity check (selfie and ID) to continue.")
	ErrVerificationUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "VERIFICATION_UNAVAILABLE", "We couldn't confirm your verification. Try again in a moment.")
)

func (gateway *PaymentGateway) customerValidationMode() string {
	switch mode := gateway.Container.Settings.CustomerValidationMode; mode {
	case models.CustomerValidationOptional, models.CustomerValidationRequired:
		return mode
	}
	return models.CustomerValidationOff
}

type verificationLevelExecutor interface {
	databases.ExecutorQuerier
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (gateway *PaymentGateway) ReadVerificationLevel(ctx context.Context, userId string) (models.VerificationLevelView, error) {
	return gateway.readVerificationLevel(ctx, gateway.Container.Resources.Database, userId)
}

func (gateway *PaymentGateway) ReadVerificationLevelInTransaction(ctx context.Context, transaction *sql.Tx, userId string) (models.VerificationLevelView, error) {
	return gateway.readVerificationLevel(ctx, transaction, userId)
}

func (gateway *PaymentGateway) readVerificationLevel(ctx context.Context, executor verificationLevelExecutor, userId string) (models.VerificationLevelView, error) {
	inputs := models.VerificationInputs{ValidationMode: gateway.customerValidationMode()}
	account, err := gateway.FindConnectedAccountRowForUser(ctx, executor, userId)
	if err != nil && !errors.Is(err, ErrConnectedAccountMissing) {
		return models.VerificationLevelView{}, err
	}
	inputs.PayoutAccountReady = err == nil && ConnectedAccountReadyForPayouts(account)
	validated, err := gateway.Container.Client(executor).CustomerValidation.Query().
		Where(customervalidation.UserID(userId), customervalidation.StatusEQ(customervalidation.StatusVerified)).Exist(ctx)
	if err != nil {
		return models.VerificationLevelView{}, err
	}
	inputs.BankAccountValidated = validated
	if inputs.Country, inputs.IdentityVerified, err = gateway.readIdentityFacts(ctx, executor, userId); err != nil {
		return models.VerificationLevelView{}, err
	}
	return models.BuildVerificationLevel(inputs), nil
}

func (gateway *PaymentGateway) readIdentityFacts(ctx context.Context, executor verificationLevelExecutor, userId string) (string, bool, error) {
	schema := gateway.Container.Settings.UsersSchema
	if schema == "" || !ledgerutils.IsUuid(userId) {
		return "", false, nil
	}
	query := `SELECT
		COALESCE((SELECT country_code FROM ` + pgx.Identifier{schema, "profiles"}.Sanitize() + ` WHERE account_id = $1::uuid AND kind = 'personal' LIMIT 1), ''),
		EXISTS (SELECT 1 FROM ` + pgx.Identifier{schema, "verification_cases"}.Sanitize() + ` WHERE account_id = $1::uuid AND status = 'approved'
			AND liveness_result = 'passed' AND face_match_result = 'passed')`
	var country string
	var verified bool
	if err := executor.QueryRowContext(ctx, query, userId).Scan(&country, &verified); err != nil {
		return "", false, err
	}
	return country, verified, nil
}

func (gateway *PaymentGateway) RequireVerificationLevel(ctx context.Context, userId string, minimum int) error {
	view, err := gateway.ReadVerificationLevel(ctx, userId)
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "verification level read failed; refusing", "userId", userId, "error", err)
		return ErrVerificationUnavailable
	}
	switch {
	case view.Level >= minimum:
		return nil
	case minimum >= models.VerificationLevelIdentity && view.Level == models.VerificationLevelPayout:
		return ErrIdentityRequired
	}
	return ErrVerificationRequired
}

func (gateway *PaymentGateway) RefreshVerificationLevel(ctx context.Context, userId string) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.refreshVerificationLevelInTransaction(ctx, transaction, userId)
	})
}

func (gateway *PaymentGateway) refreshVerificationLevelAfterCommit(ctx context.Context, userId string) {
	if err := gateway.RefreshVerificationLevel(context.WithoutCancel(ctx), userId); err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "verification level refresh failed", "userId", userId, "error", err)
	}
}

func (gateway *PaymentGateway) refreshVerificationLevelLogged(ctx context.Context, transaction *sql.Tx, userId string) error {
	if err := gateway.refreshVerificationLevelInTransaction(ctx, transaction, userId); err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "verification level refresh failed", "userId", userId, "error", err)
	}
	return nil
}

func (gateway *PaymentGateway) refreshVerificationLevelInTransaction(ctx context.Context, transaction *sql.Tx, userId string) error {
	view, err := gateway.readVerificationLevel(ctx, transaction, userId)
	if err != nil {
		return err
	}
	client := gateway.Container.Client(transaction)
	err = client.VerificationLevelRecord.Create().SetUserID(userId).OnConflictColumns(verificationlevelrecord.FieldUserID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	record, err := client.VerificationLevelRecord.Query().Where(verificationlevelrecord.UserID(userId)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	if record.Level == view.Level && record.PayoutVerified == view.PayoutVerified && record.IdentityVerified == view.IdentityVerified {
		return nil
	}
	if err := record.Update().SetLevel(view.Level).SetPayoutVerified(view.PayoutVerified).SetIdentityVerified(view.IdentityVerified).Exec(ctx); err != nil {
		return err
	}
	if record.Level == view.Level {
		return nil
	}
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "verificationLevel.changed", userId, gateway.Container.Now().UTC(), map[string]any{
		"userId": userId, "level": view.Level, "previousLevel": record.Level, "payoutVerified": view.PayoutVerified,
		"identityVerified": view.IdentityVerified, "country": view.Country, "method": view.Method,
	})
}
