package resetadminmfa

import "nantty/platform/staffauth"

type Command struct {
	Actor    staffauth.Staff
	TargetId string
	Reason   string
}
