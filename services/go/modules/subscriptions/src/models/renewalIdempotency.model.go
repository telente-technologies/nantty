package models

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"time"
)

func RenewalIdempotencyKey(subscriptionId string, periodStartsAt time.Time) string {
	return "renewal:" + subscriptionId + ":" + periodStartsAt.UTC().Format("20060102T150405Z")
}

func RenewalChargeReference(idempotencyKey string, attempt int) string {
	digest := sha256.Sum256([]byte(idempotencyKey + ":attempt:" + strconv.Itoa(attempt)))
	return "ren-" + hex.EncodeToString(digest[:])[:32]
}

func YearlyRenewalReminderAt(periodEndsAt time.Time) time.Time {
	return periodEndsAt.Add(-days(7))
}
