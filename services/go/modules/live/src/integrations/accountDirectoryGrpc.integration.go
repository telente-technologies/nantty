package integrations

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"
	"google.golang.org/grpc"

	authv1 "nantty/contracts/gen/go/zudomart/auth/v1"
	"nantty/modules/live/src/interfaces"
)

type AccountDirectoryClient struct {
	connection *grpc.ClientConn
	service    authv1.AccountDirectoryServiceClient
	options    InternalGrpcOptions
}

func DialAccountDirectory(options InternalGrpcOptions) (*AccountDirectoryClient, error) {
	connection, err := dialInternalGrpcService(options)
	if err != nil {
		return nil, fmt.Errorf("dial account directory: %w", err)
	}
	return &AccountDirectoryClient{connection: connection, service: authv1.NewAccountDirectoryServiceClient(connection), options: options}, nil
}

func (client *AccountDirectoryClient) Close() error { return client.connection.Close() }

func (client *AccountDirectoryClient) LookupParticipants(ctx context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	request := &authv1.GetAccountSummariesRequest{}
	for _, identifier := range identifiers {
		request.AccountIds = append(request.AccountIds, identifier.String())
	}
	response, err := callWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*authv1.GetAccountSummariesResponse, error) {
		return client.service.GetAccountSummaries(attempt, request)
	})
	if err != nil {
		return nil, err
	}
	found := make(map[uuid.UUID]interfaces.Participant, len(identifiers))
	for _, account := range response.GetAccounts() {
		identifier, parseErr := uuid.Parse(account.GetAccountId())
		if parseErr != nil {
			continue
		}
		found[identifier] = interfaces.Participant{
			Id: identifier, Name: account.GetName(), Username: account.GetUsername(),
			IsCreatorProgramMember: slices.Contains(account.GetRoles(), "creator"),
		}
	}
	return found, nil
}
