package events

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
)

func LoadAwsConfigHonouringEndpointOverride(ctx context.Context) (aws.Config, error) {
	return awsconfig.LoadDefaultConfig(ctx)
}
