package services

import (
	"regexp"
	"strings"

	ordererrors "nantty/modules/orders/src/errors"
)

var (
	deliveryPhonePattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)
	deliveryPhoneSpacing = strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "")
)

func NormalizeCheckoutDeliveryPhone(phone string) (string, error) {
	normalized := deliveryPhoneSpacing.Replace(strings.TrimSpace(phone))
	if !deliveryPhonePattern.MatchString(normalized) {
		return "", ordererrors.AddressPhoneRequired
	}
	return normalized, nil
}
