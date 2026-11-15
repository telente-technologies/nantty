package sellerApplications_test

import (
	"testing"

	"nantty/modules/catalog/src/modules/sellerApplications/dtos"
	"nantty/modules/catalog/src/modules/sellerApplications/validators"
)

func validSubmitRequest(enableLogistics *bool) dtos.SubmitApplicationRequest {
	return dtos.SubmitApplicationRequest{
		StoreName: "Test Store", CategoryId: "00000000-0000-4000-8000-000000000001", Description: "A test seller application",
		Phone: "+2348012345678", AddressLine: "12 Market Road", City: "Lagos", State: "Lagos", EnableLogistics: enableLogistics,
		IdentityDocument: dtos.IdentityDocumentRequest{DocumentType: "nin_slip", DocumentNumber: "1234567890", DocumentPhotoUrl: "https://example.test/id.png"},
		PayoutAccount:    dtos.PayoutAccountRequest{BankCode: "001", AccountNumber: "1234567890"},
	}
}

func TestValidateSubmitRequiresExplicitLogisticsChoice(t *testing.T) {
	if err := validators.ValidateSubmit(validSubmitRequest(nil)); err == nil {
		t.Fatal("missing logistics choice must be rejected")
	}
	for _, choice := range []bool{false, true} {
		if err := validators.ValidateSubmit(validSubmitRequest(&choice)); err != nil {
			t.Fatalf("explicit logistics choice %t should be accepted: %v", choice, err)
		}
	}
}

func TestValidateSubmitRequiresUsableSellerPhone(t *testing.T) {
	choice := false
	for _, phone := range []string{"", "   ", "----------", "123456789"} {
		request := validSubmitRequest(&choice)
		request.Phone = phone
		if err := validators.ValidateSubmit(request); err == nil {
			t.Errorf("phone %q should be rejected", phone)
		}
	}
	for _, phone := range []string{"08031234567", "+234 803 123 4567"} {
		request := validSubmitRequest(&choice)
		request.Phone = phone
		if err := validators.ValidateSubmit(request); err != nil {
			t.Errorf("phone %q should be accepted: %v", phone, err)
		}
	}
}
