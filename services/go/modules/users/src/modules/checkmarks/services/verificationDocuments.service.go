package services

import (
	"fmt"
	"strings"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationapplication"
)

type VerificationDocument struct {
	Id         string `json:"id"`
	Kind       string `json:"kind"`
	Label      string `json:"label"`
	UploadedAt string `json:"uploadedAt"`
	key        string
}

func (document VerificationDocument) StorageKey() string { return document.key }

func VerificationDocumentsOf(row *ent.VerificationApplication) []VerificationDocument {
	kind, label := "NATIONAL_ID", "Identity document"
	if row.Color == verificationapplication.ColorGold {
		kind, label = "CAC_CERTIFICATE", "Business document"
	}
	documents := make([]VerificationDocument, 0, len(row.DocumentKeys))
	for index, key := range row.DocumentKeys {
		if strings.TrimSpace(key) == "" {
			continue
		}
		documents = append(documents, VerificationDocument{
			Id: fmt.Sprintf("document-%d", index+1), Kind: kind, Label: fmt.Sprintf("%s %d", label, index+1), UploadedAt: row.CreatedAt.UTC().Format(time.RFC3339), key: key,
		})
	}
	return documents
}
