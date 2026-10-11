package events

import (
	"context"
	"log/slog"
)

func (connection *RabbitConnection) CheckReachable(ctx context.Context) error {
	outcome := make(chan error, 1)
	go func() {
		channel, err := connection.tryOpenChannel()
		if err == nil {
			_ = channel.Close()
		}
		outcome <- err
	}()
	select {
	case err := <-outcome:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func BrokerReadinessCheckFromEnvironment(deployableName string, logger *slog.Logger) (func(context.Context) error, bool) {
	url := rabbitMqUrlFromEnvironment()
	if SelectedEventBus() != EventBusRabbitMq || url == "" {
		return nil, false
	}
	return SharedRabbitConnection(url, deployableName, logger).CheckReachable, true
}
