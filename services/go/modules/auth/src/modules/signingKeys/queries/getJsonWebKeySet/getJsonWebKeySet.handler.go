package getjsonwebkeyset

import (
	"context"
	"encoding/json"

	"nantty/modules/auth/src/container"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]byte, error) {
	keySet, err := handler.Container.Keys.PublishedPublicKeySet(ctx)
	if err != nil {
		return nil, err
	}
	return json.Marshal(keySet)
}
