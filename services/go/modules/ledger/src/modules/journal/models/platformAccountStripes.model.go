package models

import (
	"fmt"
	"hash/fnv"
	"strings"
)

const (
	PlatformAccountStripeCount  = 16
	platformAccountStripeMarker = ":stripe:"
)

func (account AccountRef) IsStripedPlatformAccount() bool {
	return account.OwnerType == OwnerTypePlatform
}

func IsStripeCode(code string) bool { return strings.Contains(code, platformAccountStripeMarker) }

func PlatformAccountStripeForReference(account AccountRef, entryReference string) AccountRef {
	if !account.IsStripedPlatformAccount() || IsStripeCode(account.Code) {
		return account
	}
	hash := fnv.New32a()
	_, _ = hash.Write([]byte(entryReference))
	account.Code = fmt.Sprintf("%s%s%02d", account.Code, platformAccountStripeMarker, hash.Sum32()%PlatformAccountStripeCount)
	return account
}

func PlatformAccountStripeCodes(baseCode string) []string {
	codes := make([]string, 0, PlatformAccountStripeCount+1)
	codes = append(codes, baseCode)
	for stripe := 0; stripe < PlatformAccountStripeCount; stripe++ {
		codes = append(codes, fmt.Sprintf("%s%s%02d", baseCode, platformAccountStripeMarker, stripe))
	}
	return codes
}

func PlatformAccountBaseCode(code string) string {
	base, _, _ := strings.Cut(code, platformAccountStripeMarker)
	return base
}
