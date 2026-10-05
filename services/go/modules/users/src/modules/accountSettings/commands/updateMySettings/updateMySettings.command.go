package updatemysettings

type Command struct {
	AccountId                string
	Email                    *string
	Theme                    *string
	Language                 *string
	CountryCode              *string
	PushNotificationsEnabled *bool
	TwoFactorEnabled         *bool
}
