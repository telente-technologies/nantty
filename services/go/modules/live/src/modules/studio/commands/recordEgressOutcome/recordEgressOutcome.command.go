package recordegressoutcome

import (
	"zudomart/modules/live/src/services"
)

type Command struct {
	Outcome services.EgressOutcome
}
