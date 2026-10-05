package listjournalentries

import (
	"context"

	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/modules/journal/dtos"
	"zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/ledger/src/modules/journal/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.JournalEntryDto], error) {
	rows, next, err := handler.Container.Ledger.ListJournalEntriesNewestFirst(ctx, handler.Container.Resources.Database, services.JournalEntryPageRequest{
		Currency: query.Currency, AccountCode: query.AccountCode, Reference: query.Reference, AfterId: query.AfterId, Limit: query.Limit,
	})
	if err != nil {
		return httpserver.CursorPage[dtos.JournalEntryDto]{}, err
	}
	entries := make([]dtos.JournalEntryDto, len(rows))
	for index, row := range rows {
		entries[index] = ConvertJournalEntry(row, query.Currency)
	}
	nextCursor := ""
	if next != nil {
		nextCursor = next.String()
	}
	return httpserver.NewCursorPage(entries, nextCursor), nil
}

func ConvertJournalEntry(row *ent.JournalEntry, currency string) dtos.JournalEntryDto {
	entry := dtos.JournalEntryDto{
		Id: row.ID.String(), Reference: row.Reference, Kind: row.Kind, Description: row.Description, PostedAt: row.PostedAt,
		Legs: make([]dtos.JournalLegDto, 0, len(row.Edges.Lines)), IsBalanced: true,
		TotalDebits: dtos.MoneyDto{Currency: currency}, TotalCredits: dtos.MoneyDto{Currency: currency},
	}
	if row.ExternalReference != "" {
		external := row.ExternalReference
		entry.ExternalReference = &external
	}
	if row.ReversesEntryID != nil {
		reversed := row.ReversesEntryID.String()
		entry.ReversesEntryId = &reversed
	}
	netByCurrency := map[string]int64{}
	for _, line := range row.Edges.Lines {
		code := ""
		if line.Edges.Account != nil {
			code = models.PlatformAccountBaseCode(line.Edges.Account.Code)
		}
		entry.Legs = append(entry.Legs, dtos.JournalLegDto{
			AccountCode: code, AccountName: models.DescribeAccountCode(code), Direction: string(line.Direction),
			Amount: dtos.MoneyDto{AmountMinor: line.AmountMinor, Currency: line.Currency},
		})
		signed := line.AmountMinor
		if models.Direction(line.Direction) == models.Credit {
			signed = -signed
		}
		netByCurrency[line.Currency] += signed
		if line.Currency != currency {
			continue
		}
		if models.Direction(line.Direction) == models.Debit {
			entry.TotalDebits.AmountMinor += line.AmountMinor
		} else {
			entry.TotalCredits.AmountMinor += line.AmountMinor
		}
	}
	for _, net := range netByCurrency {
		entry.IsBalanced = entry.IsBalanced && net == 0
	}
	return entry
}
