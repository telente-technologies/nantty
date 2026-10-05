package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

const maximumStatementPages = 40

type SellerLedgerViews struct {
	Container *container.Container
}

func (views SellerLedgerViews) ReadBalances(ctx context.Context, seller dtos.SellerContext) (dtos.WalletBalancesView, error) {
	view, err := views.Container.Sellers.ReadSellerBalances(ctx, views.Container.Resources.Database, seller.SellerId, seller.Currency)
	if err != nil {
		return dtos.WalletBalancesView{}, err
	}
	return dtos.WalletBalancesView{
		Escrow: seller.Money(view.InEscrowMinor), Pending: seller.Money(view.LockedMinor), Available: seller.Money(view.WithdrawableMinor()),
		NextEscrowReleaseAt: formatOptionalTime(view.NextAvailableAt),
	}, nil
}

type TransactionFilter struct {
	Kind   string
	From   *time.Time
	Until  *time.Time
	Cursor *uuid.UUID
	Limit  int
}

func (views SellerLedgerViews) ListTransactions(ctx context.Context, seller dtos.SellerContext, filter TransactionFilter) (httpserver.CursorPage[dtos.WalletTransactionView], error) {
	collected := []dtos.WalletTransactionView{}
	after := filter.Cursor
	for page := 0; page < maximumStatementPages; page++ {
		lines, next, err := views.Container.Ledger.ListStatementLinesNewestFirst(ctx, views.Container.Resources.Database, ledgerservices.StatementPageRequest{
			Accounts:    []ledgermodels.AccountRef{ledgermodels.SellerAvailableAccount(seller.SellerId, seller.Currency), ledgermodels.SellerPendingAccount(seller.SellerId, seller.Currency)},
			AfterLineId: after, Limit: 100,
		})
		if err != nil {
			return httpserver.CursorPage[dtos.WalletTransactionView]{}, err
		}
		for _, line := range lines {
			if filter.From != nil && line.CreatedAt.Before(*filter.From) {
				return httpserver.NewCursorPage(collected, ""), nil
			}
			if line.EntryKind == "sellerCredit.matured" || (filter.Until != nil && !line.CreatedAt.Before(*filter.Until)) {
				continue
			}
			view := TransactionViewOf(line, bucketOf(line.EntryKind))
			if filter.Kind != "" && view.Kind != filter.Kind {
				continue
			}
			if len(collected) == filter.Limit {
				return httpserver.NewCursorPage(collected, collected[len(collected)-1].Id), nil
			}
			collected = append(collected, view)
		}
		if next == nil {
			break
		}
		after = next
	}
	return httpserver.NewCursorPage(collected, ""), nil
}

func TransactionViewOf(line ledgerservices.StatementLine, bucket string) dtos.WalletTransactionView {
	direction := "debit"
	if line.IncreasesBalance {
		direction = "credit"
	}
	description := line.Description
	if description == "" {
		description = line.EntryKind
	}
	return dtos.WalletTransactionView{
		Id: line.LineId.String(), Kind: SellerTransactionKindOf(line.EntryKind), Description: description,
		Amount: moneyOf(line.AmountMinor, line.Currency), Direction: direction, BalanceBucket: bucket, Reference: line.EntryReference,
		CreatedAt: line.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func SellerTransactionKindOf(entryKind string) string {
	lowered := strings.ToLower(entryKind)
	switch {
	case strings.HasPrefix(lowered, "withdrawal."):
		return "payout"
	case strings.Contains(lowered, "refund"):
		return "refund"
	case strings.Contains(lowered, "fee"):
		return "fee"
	case strings.HasPrefix(lowered, "adbalance.") || strings.HasPrefix(lowered, "adboost."):
		return "ads_charge"
	case strings.HasPrefix(lowered, "subscription."):
		return "subscription_charge"
	case strings.HasPrefix(lowered, "affiliate"):
		return "affiliate_commission"
	case strings.HasPrefix(lowered, "escrow.held"):
		return "escrow_hold"
	case strings.HasPrefix(lowered, "escrow.") || strings.HasPrefix(lowered, "sellercredit.") || strings.HasPrefix(lowered, "payment.received") || strings.HasPrefix(lowered, "directpayment."):
		return "escrow_release"
	}
	return "adjustment"
}

func (views SellerLedgerViews) ListAvailableLinesSince(ctx context.Context, seller dtos.SellerContext, since time.Time, includePending bool) ([]ledgerservices.StatementLine, *ledgerservices.StatementLine, error) {
	accounts := []ledgermodels.AccountRef{ledgermodels.SellerAvailableAccount(seller.SellerId, seller.Currency)}
	if includePending {
		accounts = append(accounts, ledgermodels.SellerPendingAccount(seller.SellerId, seller.Currency))
	}
	collected := []ledgerservices.StatementLine{}
	var after *uuid.UUID
	for page := 0; page < maximumStatementPages; page++ {
		lines, next, err := views.Container.Ledger.ListStatementLinesNewestFirst(ctx, views.Container.Resources.Database, ledgerservices.StatementPageRequest{Accounts: accounts, AfterLineId: after, Limit: 100})
		if err != nil {
			return nil, nil, err
		}
		for index, line := range lines {
			if line.CreatedAt.Before(since) {
				return collected, &lines[index], nil
			}
			collected = append(collected, line)
		}
		if next == nil {
			break
		}
		after = next
	}
	return collected, nil, nil
}

func formatOptionalTime(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}

func bucketOf(entryKind string) string {
	if entryKind == "sellerCredit.locked" {
		return "pending"
	}
	return "available"
}
