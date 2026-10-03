package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/platform/identityports"
)

func (application *UsersApplication) DescribeUsernameBlock(ctx context.Context, username string, requester uuid.UUID) (identityports.UsernameBlock, error) {
	return identityports.UsernameBlock{}, nil
}

func (application *UsersApplication) FindAccountCountryCode(ctx context.Context, accountId uuid.UUID) (string, error) {
	return "", nil
}
