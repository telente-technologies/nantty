package services

import (
	"encoding/json"

	"nantty/platform/staffauth"
)

func (detail UserDetail) VisibleTo(staff staffauth.Staff) UserDetail {
	if !staff.Can("audit:read") {
		detail.History = []json.RawMessage{}
	}
	if !staff.Can("users:read-pii") {
		sessions := make([]SessionView, 0, len(detail.Sessions))
		for _, session := range detail.Sessions {
			session.IpAddress, session.Location = "", ""
			sessions = append(sessions, session)
		}
		detail.Sessions = sessions
	}
	return detail
}
