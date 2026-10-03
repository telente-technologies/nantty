package recordauditevent

import "zudomart/platform/identityports"

type Command struct {
	Event identityports.AuditEvent
}
