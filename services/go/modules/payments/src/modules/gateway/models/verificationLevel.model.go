package models

const (
	VerificationLevelAccount  = 0
	VerificationLevelPayout   = 1
	VerificationLevelIdentity = 2
)

const (
	CustomerValidationOff      = "off"
	CustomerValidationOptional = "optional"
	CustomerValidationRequired = "required"
)

type VerificationInputs struct {
	Country              string
	PayoutAccountReady   bool
	ValidationMode       string
	BankAccountValidated bool
	IdentityVerified     bool
}

type VerificationUnlocks struct {
	Withdrawals bool `json:"withdrawals"`
	CreatorCash bool `json:"creatorCash"`
	Ads         bool `json:"ads"`
	Checkmarks  bool `json:"checkmarks"`
}

type VerificationLevelView struct {
	Level            int                 `json:"level"`
	PayoutVerified   bool                `json:"payoutVerified"`
	IdentityVerified bool                `json:"identityVerified"`
	Country          string              `json:"country"`
	Method           *string             `json:"method"`
	NextStep         *string             `json:"nextStep"`
	Unlocks          VerificationUnlocks `json:"unlocks"`
}

func BuildVerificationLevel(inputs VerificationInputs) VerificationLevelView {
	country := inputs.Country
	if country == "" {
		country = "NG"
	}
	view := VerificationLevelView{Country: country, IdentityVerified: inputs.IdentityVerified}
	method, nextStep := "", "payout_setup"
	if country == "NG" {
		switch {
		case !inputs.PayoutAccountReady:
		case inputs.ValidationMode == CustomerValidationRequired && !inputs.BankAccountValidated:
			nextStep = "bank_validation"
		case inputs.BankAccountValidated:
			view.PayoutVerified, method = true, "bank_account"
		default:
			view.PayoutVerified, method = true, "payout_account"
		}
	} else if inputs.IdentityVerified {
		view.PayoutVerified, method = true, "smile_id"
	} else {
		nextStep = "identity_check"
	}
	if view.PayoutVerified {
		view.Level, nextStep = VerificationLevelPayout, "identity_check"
		if inputs.IdentityVerified {
			view.Level, nextStep = VerificationLevelIdentity, ""
		}
	}
	if method != "" {
		view.Method = &method
	}
	if nextStep != "" {
		view.NextStep = &nextStep
	}
	payout := view.Level >= VerificationLevelPayout
	view.Unlocks = VerificationUnlocks{Withdrawals: payout, CreatorCash: payout, Ads: payout, Checkmarks: view.Level >= VerificationLevelIdentity}
	return view
}
