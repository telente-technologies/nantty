package validators

import (
	"slices"
	"strings"

	"zudomart/modules/catalog/src/modules/reviews/dtos"
	"zudomart/modules/catalog/src/utils"
)

var reportReasons = []string{"spam", "offensive", "fake", "not_about_purchase", "personal_information", "other"}

func ValidateSubmitReview(body dtos.SubmitReviewRequest) error {
	var collected utils.Issues
	collected.CheckRange("rating", body.Rating, 1, 5)
	collected.CheckLength("text", body.Text, 1, 2000)
	if body.Title != nil && len(*body.Title) > 120 {
		collected.Add("title", "must be at most 120 characters")
	}
	return collected.AsError()
}

func ValidateReply(body dtos.ReplyRequest) error {
	var collected utils.Issues
	collected.CheckLength("body", body.Body, 2, 1000)
	return collected.AsError()
}

func ValidateReport(body dtos.ReportRequest) error {
	var collected utils.Issues
	if !slices.Contains(reportReasons, body.Reason) {
		collected.Add("reason", "must be one of "+strings.Join(reportReasons, ", "))
	}
	details := ""
	if body.Details != nil {
		details = strings.TrimSpace(*body.Details)
	}
	if len(details) > 500 || (body.Reason == "other" && len(details) < 5) {
		collected.Add("details", "must be 5-500 characters when the reason is other")
	}
	return collected.AsError()
}
