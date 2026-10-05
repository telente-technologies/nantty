package interfaces

import (
	"context"
	"strings"
	"time"
)

type RefundLookup struct {
	ProviderChargeId string
	ChargeReference  string
	RefundReference  string
	SubmittedAfter   time.Time
}

type RefundLookupProvider interface {
	FindRefundByReference(ctx context.Context, lookup RefundLookup) (RefundResult, bool, error)
}

func RefundReferenceNote(reason, refundReference string) string {
	if refundReference == "" {
		return reason
	}
	marker := " [ref:" + refundReference + "]"
	if len(reason)+len(marker) > 250 {
		reason = reason[:max(0, 250-len(marker))]
	}
	return reason + marker
}

func NoteCarriesRefundReference(note, refundReference string) bool {
	return refundReference != "" && strings.Contains(note, "[ref:"+refundReference+"]")
}
