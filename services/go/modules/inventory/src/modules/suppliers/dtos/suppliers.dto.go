package dtos

type SupplierRequest struct {
	Name         string  `json:"name"`
	ContactName  string  `json:"contactName"`
	Phone        string  `json:"phone"`
	Email        *string `json:"email"`
	Address      string  `json:"address"`
	LeadTimeDays int     `json:"leadTimeDays"`
	PaymentTerms string  `json:"paymentTerms"`
	Notes        *string `json:"notes"`
}
