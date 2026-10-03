package reconcileprovidersettlements

import "time"

type Command struct {
	Provider string
	From     time.Time
	To       time.Time
}
