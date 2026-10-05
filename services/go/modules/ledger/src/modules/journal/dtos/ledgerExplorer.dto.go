package dtos

import "time"

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type LedgerAccountDto struct {
	Code       string   `json:"code"`
	Name       string   `json:"name"`
	Kind       string   `json:"kind"`
	Currency   string   `json:"currency"`
	Balance    MoneyDto `json:"balance"`
	OwnerType  *string  `json:"ownerType"`
	OwnerId    *string  `json:"ownerId"`
	EntryCount int64    `json:"entryCount"`
}

type JournalLegDto struct {
	AccountCode string   `json:"accountCode"`
	AccountName string   `json:"accountName"`
	Direction   string   `json:"direction"`
	Amount      MoneyDto `json:"amount"`
}

type JournalEntryDto struct {
	Id                string          `json:"id"`
	Reference         string          `json:"reference"`
	ExternalReference *string         `json:"externalReference"`
	Kind              string          `json:"kind"`
	Description       string          `json:"description"`
	ReversesEntryId   *string         `json:"reversesEntryId"`
	PostedAt          time.Time       `json:"postedAt"`
	Legs              []JournalLegDto `json:"legs"`
	TotalDebits       MoneyDto        `json:"totalDebits"`
	TotalCredits      MoneyDto        `json:"totalCredits"`
	IsBalanced        bool            `json:"isBalanced"`
}
