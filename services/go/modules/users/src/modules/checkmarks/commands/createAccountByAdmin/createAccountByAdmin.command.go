package createaccountbyadmin

import "nantty/modules/users/src/types"

type Command struct {
	Actor       types.StaffActor
	Username    string
	DisplayName string
	Email       string
	Password    string
	Country     string
	ProfileType string
	Reason      string
}
