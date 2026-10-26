package recordegressoutcome

import (
	"nantty/modules/live/src/services"
)

type Command struct {
	Outcome services.EgressOutcome
}
