package renderbillingdocument

import "github.com/google/uuid"

type Query struct {
	AccountId     uuid.UUID
	UserId        uuid.UUID
	InvoiceId     string
	TransactionId string
}

type Document struct {
	FileName string
	Bytes    []byte
}
