package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

func monthBounds(month time.Time, location *time.Location) (time.Time, time.Time) {
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, location)
	return start, start.AddDate(0, 1, 0)
}

func signedAmount(line ledgerservices.StatementLine) int64 {
	if line.IncreasesBalance {
		return line.AmountMinor
	}
	return -line.AmountMinor
}

func summariseMonth(seller dtos.SellerContext, month string, lines []ledgerservices.StatementLine, before *ledgerservices.StatementLine, movements int) dtos.StatementMonthView {
	opening := int64(0)
	if before != nil {
		opening = before.BalanceAfterMinor
	}
	if len(lines) > 0 {
		oldest := lines[len(lines)-1]
		opening = oldest.BalanceAfterMinor - signedAmount(oldest)
	}
	credits, debits := int64(0), int64(0)
	for _, line := range lines {
		if line.IncreasesBalance {
			credits += line.AmountMinor
		} else {
			debits += line.AmountMinor
		}
	}
	return dtos.StatementMonthView{Month: month, OpeningBalance: seller.Money(opening), Credits: seller.Money(credits), Debits: seller.Money(debits),
		ClosingBalance: seller.Money(opening + credits - debits), TransactionsCount: movements}
}

func linesWithin(lines []ledgerservices.StatementLine, start, end time.Time) []ledgerservices.StatementLine {
	within := []ledgerservices.StatementLine{}
	for _, line := range lines {
		if !line.CreatedAt.Before(start) && line.CreatedAt.Before(end) {
			within = append(within, line)
		}
	}
	return within
}

func firstLineBefore(lines []ledgerservices.StatementLine, boundary time.Time, fallback *ledgerservices.StatementLine) *ledgerservices.StatementLine {
	for index := range lines {
		if lines[index].CreatedAt.Before(boundary) {
			return &lines[index]
		}
	}
	return fallback
}

func (views SellerLedgerViews) ListMonthlyStatements(ctx context.Context, seller dtos.SellerContext, now time.Time) ([]dtos.StatementMonthView, error) {
	current := now.In(seller.Location)
	oldestStart, _ := monthBounds(current.AddDate(0, -11, 0), seller.Location)
	available, before, err := views.ListAvailableLinesSince(ctx, seller, oldestStart, false)
	if err != nil {
		return nil, err
	}
	every, _, err := views.ListAvailableLinesSince(ctx, seller, oldestStart, true)
	if err != nil {
		return nil, err
	}
	months := make([]dtos.StatementMonthView, 0, 12)
	for offset := 0; offset < 12; offset++ {
		start, end := monthBounds(current.AddDate(0, -offset, 0), seller.Location)
		within := linesWithin(available, start, end)
		months = append(months, summariseMonth(seller, start.Format("2006-01"), within, firstLineBefore(available, start, before), len(linesWithin(every, start, end))))
	}
	return months, nil
}

func (views SellerLedgerViews) ReadMonthStatement(ctx context.Context, seller dtos.SellerContext, month time.Time, now time.Time) (dtos.StatementDetailView, error) {
	start, end := monthBounds(month, seller.Location)
	available, before, err := views.ListAvailableLinesSince(ctx, seller, start, false)
	if err != nil {
		return dtos.StatementDetailView{}, err
	}
	every, _, err := views.ListAvailableLinesSince(ctx, seller, start, true)
	if err != nil {
		return dtos.StatementDetailView{}, err
	}
	within := linesWithin(available, start, end)
	summary := summariseMonth(seller, start.Format("2006-01"), within, firstLineBefore(available, start, before), len(linesWithin(every, start, end)))
	lines := make([]dtos.StatementLineView, 0, len(within))
	for index := len(within) - 1; index >= 0; index-- {
		line := within[index]
		lines = append(lines, dtos.StatementLineView{WalletTransactionView: TransactionViewOf(line, "available"), RunningBalance: seller.Money(line.BalanceAfterMinor)})
	}
	return dtos.StatementDetailView{Summary: summary, StoreName: seller.StoreName, GeneratedAt: now.UTC().Format(time.RFC3339), Lines: lines}, nil
}

var formulaPrefixes = "=+-@\t\r"

func neutraliseCell(value string) string {
	if value != "" && strings.ContainsRune(formulaPrefixes, rune(value[0])) {
		return "'" + value
	}
	return value
}

func StatementCsv(detail dtos.StatementDetailView, currency string, decimals int) []byte {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	_ = writer.Write([]string{"Date", "Description", "Reference", "Type", "Balance", "Direction", "Amount (" + currency + ")"})
	for _, line := range detail.Lines {
		amount := line.Amount.AmountMinor
		if line.Direction == "debit" {
			amount = -amount
		}
		_ = writer.Write([]string{line.CreatedAt, neutraliseCell(line.Description), neutraliseCell(line.Reference), line.Kind, line.BalanceBucket, line.Direction, formatMajor(amount, decimals)})
	}
	writer.Flush()
	return buffer.Bytes()
}

func formatMajor(amountMinor int64, decimals int) string {
	if decimals == 0 {
		return fmt.Sprintf("%d", amountMinor)
	}
	sign := ""
	if amountMinor < 0 {
		sign, amountMinor = "-", -amountMinor
	}
	divisor := int64(1)
	for range decimals {
		divisor *= 10
	}
	return fmt.Sprintf("%s%d.%0*d", sign, amountMinor/divisor, decimals, amountMinor%divisor)
}
