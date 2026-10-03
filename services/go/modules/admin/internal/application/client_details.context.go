package application

import "context"

type ClientDetails struct {
	IpAddress string
	UserAgent string
	RequestId string
}

type clientDetailsKey struct{}

func ContextWithClientDetails(ctx context.Context, details ClientDetails) context.Context {
	return context.WithValue(ctx, clientDetailsKey{}, details)
}

func clientDetailsFromContext(ctx context.Context) ClientDetails {
	details, _ := ctx.Value(clientDetailsKey{}).(ClientDetails)
	return details
}

func truncateToLength(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}
