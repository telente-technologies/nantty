package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/payoutaccount"
	"nantty/modules/wallet/src/generated/ent/withdrawal"
	"nantty/modules/wallet/src/modules/payouts/dtos"
)

type StaffWithdrawalFilter struct {
	Status  string
	Search  string
	AfterId *uuid.UUID
	Limit   int
}

func (withdrawals Withdrawals) ListWithdrawalsForStaff(ctx context.Context, filter StaffWithdrawalFilter) (dtos.StaffWithdrawalListDto, error) {
	client := withdrawals.Container.Client(withdrawals.Container.Resources.Database)
	query := client.Withdrawal.Query()
	if filter.Status != "" {
		query.Where(withdrawal.StatusEQ(withdrawal.Status(filter.Status)))
	}
	if search := strings.TrimSpace(filter.Search); search != "" {
		if ledgerutils.IsUuid(search) {
			query.Where(withdrawal.Or(withdrawal.UserID(strings.ToLower(search)), withdrawal.ID(uuid.MustParse(search))))
		} else {
			query.Where(withdrawal.Reference(search))
		}
	}
	oldestFirst := IsWithdrawalQueueStatus(filter.Status)
	if filter.AfterId != nil {
		if oldestFirst {
			query.Where(withdrawal.IDGT(*filter.AfterId))
		} else {
			query.Where(withdrawal.IDLT(*filter.AfterId))
		}
	}
	order := ent.Desc(withdrawal.FieldID)
	if oldestFirst {
		order = ent.Asc(withdrawal.FieldID)
	}
	rows, err := query.Order(order).Limit(filter.Limit + 1).All(ctx)
	if err != nil {
		return dtos.StaffWithdrawalListDto{}, err
	}
	var nextCursor *string
	if len(rows) > filter.Limit {
		rows = rows[:filter.Limit]
		cursor := rows[len(rows)-1].ID.String()
		nextCursor = &cursor
	}
	views, err := withdrawals.convertForStaff(ctx, client, rows)
	if err != nil {
		return dtos.StaffWithdrawalListDto{}, err
	}
	counts, err := countWithdrawalsByStatus(ctx, client)
	if err != nil {
		return dtos.StaffWithdrawalListDto{}, err
	}
	return dtos.StaffWithdrawalListDto{Data: views, NextCursor: nextCursor, Counts: counts}, nil
}

func (withdrawals Withdrawals) GetWithdrawalForStaff(ctx context.Context, withdrawalId uuid.UUID) (dtos.StaffWithdrawalDetailDto, error) {
	database := withdrawals.Container.Resources.Database
	client := withdrawals.Container.Client(database)
	row, err := client.Withdrawal.Get(ctx, withdrawalId)
	if ent.IsNotFound(err) {
		return dtos.StaffWithdrawalDetailDto{}, ErrWithdrawalNotFound
	}
	if err != nil {
		return dtos.StaffWithdrawalDetailDto{}, err
	}
	views, err := withdrawals.convertForStaff(ctx, client, []*ent.Withdrawal{row})
	if err != nil {
		return dtos.StaffWithdrawalDetailDto{}, err
	}
	available, err := withdrawals.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.UserCashAccountsForProvider(row.Provider, row.UserID, row.Currency).Available)
	if err != nil {
		return dtos.StaffWithdrawalDetailDto{}, err
	}
	recent, err := client.Withdrawal.Query().Where(withdrawal.UserID(row.UserID), withdrawal.IDNEQ(row.ID)).Order(ent.Desc(withdrawal.FieldID)).Limit(5).All(ctx)
	if err != nil {
		return dtos.StaffWithdrawalDetailDto{}, err
	}
	detail := dtos.StaffWithdrawalDetailDto{
		StaffWithdrawalDto: views[0], AvailableBalance: dtos.MoneyDto{AmountMinor: available, Currency: row.Currency}, RecentWithdrawals: []dtos.RecentWithdrawalDto{},
	}
	for _, earlier := range recent {
		detail.RecentWithdrawals = append(detail.RecentWithdrawals, dtos.RecentWithdrawalDto{
			Id: earlier.ID.String(), Amount: dtos.MoneyDto{AmountMinor: earlier.AmountMinor, Currency: earlier.Currency}, WithdrawalStatus: string(earlier.Status), CreatedAt: earlier.CreatedAt,
		})
	}
	return detail, nil
}

func (withdrawals Withdrawals) convertForStaff(ctx context.Context, client *ent.Client, rows []*ent.Withdrawal) ([]dtos.StaffWithdrawalDto, error) {
	accountIds, userIds := []uuid.UUID{}, []string{}
	for _, row := range rows {
		accountIds = append(accountIds, row.PayoutAccountID)
		userIds = append(userIds, row.UserID)
	}
	accounts, err := client.PayoutAccount.Query().Where(payoutaccount.IDIn(accountIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	accountsById := map[uuid.UUID]*ent.PayoutAccount{}
	for _, account := range accounts {
		accountsById[account.ID] = account
	}
	parties := withdrawals.Container.Parties.DescribeAccounts(ctx, userIds)
	views := make([]dtos.StaffWithdrawalDto, len(rows))
	for index, row := range rows {
		view := dtos.StaffWithdrawalDto{WithdrawalDto: ConvertWithdrawal(row), UserId: row.UserID, User: parties[row.UserID], Provider: row.Provider, ReviewedAt: row.ReviewedAt,
			AgeHours: int(withdrawals.Container.Now().Sub(row.CreatedAt).Hours())}
		if account := accountsById[row.PayoutAccountID]; account != nil {
			view.Destination = &dtos.PayoutDestinationDto{
				PayoutAccountId: account.ID.String(), BankName: account.BankName, AccountLast4: account.AccountNumberLast4, AccountName: account.AccountName,
				CountryCode: account.CountryCode, AddedAt: account.CreatedAt, Removed: account.DeletedAt != nil,
			}
		}
		if row.ReviewedByStaffID != "" {
			reviewer := row.ReviewedByStaffID
			view.ReviewedByStaffId = &reviewer
		}
		if row.ReviewNote != "" {
			note := row.ReviewNote
			view.ReviewNote = &note
		}
		views[index] = view
	}
	return views, nil
}

func countWithdrawalsByStatus(ctx context.Context, client *ent.Client) (map[string]int, error) {
	counts := map[string]int{}
	for _, status := range []withdrawal.Status{withdrawal.StatusPendingReview, withdrawal.StatusOnHold, withdrawal.StatusQueued, withdrawal.StatusProcessing, withdrawal.StatusPaid, withdrawal.StatusFailed, withdrawal.StatusCancelled} {
		counts[string(status)] = 0
	}
	var rows []struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}
	if err := client.Withdrawal.Query().GroupBy(withdrawal.FieldStatus).Aggregate(ent.Count()).Scan(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	return counts, nil
}

func IsWithdrawalQueueStatus(status string) bool {
	switch withdrawal.Status(status) {
	case withdrawal.StatusPendingReview, withdrawal.StatusOnHold, withdrawal.StatusQueued:
		return true
	}
	return false
}
