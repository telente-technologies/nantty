package interfaces

import "context"

type IpCountryLookup interface {
	FindCountryCodeForIpAddress(ctx context.Context, ipAddress string) (string, error)
}
