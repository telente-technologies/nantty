package servicemodule

import (
	"fmt"
	"time"
)

func HTTPWriteTimeoutForDeployable(deployableName string, configured time.Duration) (time.Duration, error) {
	defaultTimeout := 30 * time.Second
	maximumTimeout := time.Duration(0)
	if deployableName == "go-identity" {
		maximumTimeout = 30 * time.Second
	}
	if configured == 0 {
		configured = defaultTimeout
	}
	if configured < 0 || (maximumTimeout > 0 && configured > maximumTimeout) {
		return 0, fmt.Errorf("HTTP_WRITE_TIMEOUT must not exceed %s for %s", maximumTimeout, deployableName)
	}
	return configured, nil
}
