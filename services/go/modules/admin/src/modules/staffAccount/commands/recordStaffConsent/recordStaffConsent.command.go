package recordstaffconsent

import "time"

type Command struct {
	StaffId       string
	PolicyVersion string
	DecidedAt     time.Time
	Categories    map[string]bool
	Source        string
}
