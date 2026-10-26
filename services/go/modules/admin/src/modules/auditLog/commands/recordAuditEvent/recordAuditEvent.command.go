package recordauditevent

import "nantty/platform/identityports"

type Command struct {
	Event identityports.AuditEvent
}
