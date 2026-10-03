package inventory

import (
	"errors"

	"zudomart/platform/commerceports"
)

func asInsufficient(err error, target *commerceports.InsufficientStockError) bool {
	return errors.As(err, target)
}
