package getstaffsettings

type Query struct{}

type Result struct {
	RequireSecondSuperadminApproval bool `json:"requireSecondSuperadminApproval"`
}
