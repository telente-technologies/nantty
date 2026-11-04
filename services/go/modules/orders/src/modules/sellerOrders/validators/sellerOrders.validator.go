package validators

import (
	"net/url"
	"regexp"
	"slices"
	"strings"

	"nantty/modules/orders/src/modules/sellerOrders/dtos"
	"nantty/modules/orders/src/utils"
)

var trackingPattern = regexp.MustCompile(`^[A-Za-z0-9-]{4,40}$`)
var phonePattern = regexp.MustCompile(`^\+?[0-9 ]{7,16}$`)

func ValidateReason(body dtos.ReasonRequest) error {
	var collected utils.Issues
	collected.CheckLength("reason", body.Reason, 5, 500)
	return collected.AsError()
}

func ValidateRefund(body dtos.RefundRequest) error {
	var collected utils.Issues
	collected.CheckLength("reason", body.Reason, 5, 500)
	return collected.AsError()
}

func ValidateStatus(body dtos.StatusRequest) error {
	var collected utils.Issues
	if !slices.Contains([]string{"processing", "ready", "delivered"}, body.Status) {
		collected.Add("status", "must be processing, ready or delivered")
	}
	return collected.AsError()
}

func ValidateFulfilment(body dtos.FulfilmentRequest) error {
	var collected utils.Issues
	collected.CheckLength("courier", body.Courier, 2, 60)
	if !trackingPattern.MatchString(body.TrackingNumber) {
		collected.Add("trackingNumber", "must be 4-40 letters, digits or hyphens")
	}
	if body.TrackingUrl != nil {
		if parsed, err := url.Parse(*body.TrackingUrl); err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil || len(*body.TrackingUrl) > 300 {
			collected.Add("trackingUrl", "must be an https link of at most 300 characters")
		}
	}
	utils.ParseIdentifier("fromLocationId", body.FromLocationId, &collected)
	return collected.AsError()
}

func ValidateNote(body dtos.NoteRequest) error {
	var collected utils.Issues
	collected.CheckLength("body", body.Body, 2, 1000)
	return collected.AsError()
}

func ValidateShipmentPatch(body dtos.ShipmentPatchRequest) error {
	var collected utils.Issues
	if body.RiderName != nil && *body.RiderName != "" {
		collected.CheckLength("riderName", *body.RiderName, 2, 60)
	}
	if body.RiderPhone != nil && *body.RiderPhone != "" && !phonePattern.MatchString(*body.RiderPhone) {
		collected.Add("riderPhone", "must be a valid phone number")
	}
	return collected.AsError()
}

func ValidateAttempt(body dtos.AttemptRequest) error {
	var collected utils.Issues
	if body.Outcome != "delivered" && body.Outcome != "failed" {
		collected.Add("outcome", "must be delivered or failed")
	}
	if body.Outcome == "failed" && len(strings.TrimSpace(body.Note)) < 3 {
		collected.Add("note", "is required when the attempt failed")
	}
	if len(body.Note) > 300 {
		collected.Add("note", "must be at most 300 characters")
	}
	return collected.AsError()
}
