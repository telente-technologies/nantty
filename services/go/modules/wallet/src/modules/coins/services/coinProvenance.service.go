package services

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/wallet/src/modules/coins/models"
)

func (purchases CoinPurchases) unspentCoinsFromLedgerCredit(ctx context.Context, transaction *sql.Tx, userId, sourceId, sourceReference string, sourceCoins int64) (models.CoinClawback, error) {
	account := ledgermodels.UserSpendableCoinsAccount(userId)
	if err := purchases.Container.Ledger.LockSpendableCoinAccounts(ctx, transaction, []ledgermodels.JournalLineRequest{{Account: account}}); err != nil {
		return models.CoinClawback{}, err
	}
	schema := purchases.Container.Settings.Money.LedgerSchema
	accounts := pgx.Identifier{schema, "ledger_accounts"}.Sanitize()
	entries := pgx.Identifier{schema, "journal_entries"}.Sanitize()
	lines := pgx.Identifier{schema, "journal_lines"}.Sanitize()
	var accountId string
	var storedBalance int64
	if err := transaction.QueryRowContext(ctx, `SELECT id, balance_minor FROM `+accounts+` WHERE code = $1 AND currency = $2`, account.Code, account.Currency).Scan(&accountId, &storedBalance); err != nil {
		return models.CoinClawback{}, fmt.Errorf("load purchased coin ledger account: %w", err)
	}
	rows, err := transaction.QueryContext(ctx, `SELECT e.reference, COALESCE(e.metadata->>'coinTransferId', ''), l.direction, l.amount_minor, l.balance_after_minor FROM `+lines+` l
		JOIN `+entries+` e ON e.id = l.entry_id WHERE l.account_id = $1
		ORDER BY e.posted_at, e.id, l.line_number`, accountId)
	if err != nil {
		return models.CoinClawback{}, err
	}
	type lot struct {
		purchase bool
		coins    int64
	}
	lots := []lot{}
	targetCredits := int64(0)
	runningBalance := int64(0)
	for rows.Next() {
		var reference, entrySourceId, direction string
		var amount, balanceAfter int64
		if err := rows.Scan(&reference, &entrySourceId, &direction, &amount, &balanceAfter); err != nil {
			rows.Close()
			return models.CoinClawback{}, err
		}
		if amount <= 0 {
			rows.Close()
			return models.CoinClawback{}, fmt.Errorf("invalid coin ledger amount")
		}
		if direction == string(ledgermodels.Credit) {
			runningBalance += amount
		} else if direction == string(ledgermodels.Debit) {
			runningBalance -= amount
		} else {
			rows.Close()
			return models.CoinClawback{}, fmt.Errorf("invalid coin ledger direction")
		}
		if runningBalance < 0 || runningBalance != balanceAfter {
			rows.Close()
			return models.CoinClawback{}, fmt.Errorf("coin ledger history order does not reconcile")
		}
		if direction == string(ledgermodels.Credit) {
			isSource := reference == sourceReference || entrySourceId == sourceId
			lots = append(lots, lot{purchase: isSource, coins: amount})
			if isSource {
				targetCredits += amount
			}
			continue
		}
		remaining := amount
		for index := range lots {
			spent := min(remaining, lots[index].coins)
			lots[index].coins -= spent
			remaining -= spent
			if remaining == 0 {
				break
			}
		}
		if remaining != 0 {
			rows.Close()
			return models.CoinClawback{}, fmt.Errorf("coin ledger history does not reconcile")
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return models.CoinClawback{}, err
	}
	if err := rows.Close(); err != nil {
		return models.CoinClawback{}, err
	}
	if targetCredits != sourceCoins {
		return models.CoinClawback{}, fmt.Errorf("coin credit provenance does not reconcile")
	}
	if runningBalance != storedBalance {
		return models.CoinClawback{}, fmt.Errorf("coin ledger balance does not reconcile")
	}
	unspent := int64(0)
	for _, item := range lots {
		if item.purchase {
			unspent += item.coins
		}
	}
	return models.CoinClawback{RecoveredCoins: unspent, ShortfallCoins: sourceCoins - unspent}, nil
}
