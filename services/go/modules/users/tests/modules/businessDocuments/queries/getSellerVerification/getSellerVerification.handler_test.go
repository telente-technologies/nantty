package getsellerverification_test

import (
	"testing"

	getmybusinessdocuments "nantty/modules/users/src/modules/businessDocuments/queries/getMyBusinessDocuments"
	getsellerverification "nantty/modules/users/src/modules/businessDocuments/queries/getSellerVerification"
)

func TestVerificationSummaryFollowsTheDocuments(t *testing.T) {
	reason, early, late := "Blurry photo", "2026-10-01T09:00:00Z", "2026-10-02T09:00:00Z"
	result := getsellerverification.Summarise(getmybusinessdocuments.Result{Documents: []getmybusinessdocuments.Document{
		{Kind: "cac_certificate", Status: "approved", SubmittedAt: &late}, {Kind: "identity", Status: "rejected", RejectionReason: &reason, SubmittedAt: &early}, {Kind: "address_proof", Status: "not_uploaded"},
	}})
	if result.Status != "pending" || *result.Note != reason || *result.SubmittedAt != early || result.Documents[2].Status != "missing" {
		t.Fatalf("summary: %+v", result)
	}
	if getsellerverification.Summarise(getmybusinessdocuments.Result{Documents: []getmybusinessdocuments.Document{{Status: "approved"}}}).Status != "verified" {
		t.Fatal("all approved means verified")
	}
}
