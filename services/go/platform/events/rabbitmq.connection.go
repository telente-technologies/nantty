package events

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

var ErrRabbitConnectionClosed = errors.New("rabbitmq connection is closed")

type amqpChannel interface {
	PublishWithContext(ctx context.Context, exchange, key string, mandatory, immediate bool, msg amqp.Publishing) error
	Confirm(noWait bool) error
	NotifyPublish(confirm chan amqp.Confirmation) chan amqp.Confirmation
	NotifyReturn(returns chan amqp.Return) chan amqp.Return
	Qos(prefetchCount, prefetchSize int, global bool) error
	ConsumeWithContext(ctx context.Context, queue, consumer string, autoAck, exclusive, noLocal, noWait bool, args amqp.Table) (<-chan amqp.Delivery, error)
	Cancel(consumer string, noWait bool) error
	Close() error
	IsClosed() bool
}

type amqpConnection interface {
	OpenChannel() (amqpChannel, error)
	Close() error
	IsClosed() bool
}

type channelOpener interface {
	OpenChannel(ctx context.Context) (amqpChannel, error)
}

type amqpConnectionAdapter struct {
	connection *amqp.Connection
}

func (adapter amqpConnectionAdapter) OpenChannel() (amqpChannel, error) {
	channel, err := adapter.connection.Channel()
	if err != nil {
		return nil, err
	}
	return channel, nil
}

func (adapter amqpConnectionAdapter) Close() error   { return adapter.connection.Close() }
func (adapter amqpConnectionAdapter) IsClosed() bool { return adapter.connection.IsClosed() }

func dialRabbitMq(url, connectionName string) (amqpConnection, error) {
	connection, err := amqp.DialConfig(url, amqp.Config{
		Heartbeat:  10 * time.Second,
		Properties: amqp.Table{"connection_name": connectionName},
	})
	if err != nil {
		return nil, err
	}
	return amqpConnectionAdapter{connection: connection}, nil
}

type RabbitConnection struct {
	url            string
	connectionName string
	logger         *slog.Logger
	dial           func(url, connectionName string) (amqpConnection, error)
	backoff        func(attempt int) time.Duration
	mutex          sync.Mutex
	current        amqpConnection
	closed         bool
}

func NewRabbitConnection(url, connectionName string, logger *slog.Logger) *RabbitConnection {
	return &RabbitConnection{url: url, connectionName: connectionName, logger: logger, dial: dialRabbitMq, backoff: ReconnectBackoffWithJitter}
}

func ReconnectBackoffWithJitter(attempt int) time.Duration {
	base := 500 * time.Millisecond << min(attempt, 6)
	base = min(base, 30*time.Second)
	return base/2 + time.Duration(rand.Int64N(int64(base/2)+1))
}

func (connection *RabbitConnection) OpenChannel(ctx context.Context) (amqpChannel, error) {
	for attempt := 0; ; attempt++ {
		channel, err := connection.tryOpenChannel()
		if err == nil {
			return channel, nil
		}
		if errors.Is(err, ErrRabbitConnectionClosed) {
			return nil, err
		}
		connection.logger.WarnContext(ctx, "rabbitmq unavailable; reconnecting", slog.Int("attempt", attempt+1), slog.Any("error", err))
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(connection.backoff(attempt)):
		}
	}
}

func (connection *RabbitConnection) tryOpenChannel() (amqpChannel, error) {
	connection.mutex.Lock()
	defer connection.mutex.Unlock()
	if connection.closed {
		return nil, ErrRabbitConnectionClosed
	}
	if connection.current == nil || connection.current.IsClosed() {
		dialled, err := connection.dial(connection.url, connection.connectionName)
		if err != nil {
			return nil, err
		}
		connection.current = dialled
	}
	channel, err := connection.current.OpenChannel()
	if err != nil {
		_ = connection.current.Close()
		connection.current = nil
		return nil, err
	}
	return channel, nil
}

func (connection *RabbitConnection) Close() error {
	connection.mutex.Lock()
	defer connection.mutex.Unlock()
	connection.closed = true
	if connection.current == nil || connection.current.IsClosed() {
		return nil
	}
	return connection.current.Close()
}

var sharedRabbitConnections = struct {
	mutex       sync.Mutex
	connections map[string]*RabbitConnection
}{connections: map[string]*RabbitConnection{}}

func SharedRabbitConnection(url, connectionName string, logger *slog.Logger) *RabbitConnection {
	sharedRabbitConnections.mutex.Lock()
	defer sharedRabbitConnections.mutex.Unlock()
	if existing, found := sharedRabbitConnections.connections[url]; found {
		return existing
	}
	created := NewRabbitConnection(url, connectionName, logger)
	sharedRabbitConnections.connections[url] = created
	return created
}

func CloseSharedRabbitConnections(context.Context) error {
	sharedRabbitConnections.mutex.Lock()
	defer sharedRabbitConnections.mutex.Unlock()
	var combined error
	for url, connection := range sharedRabbitConnections.connections {
		combined = errors.Join(combined, connection.Close())
		delete(sharedRabbitConnections.connections, url)
	}
	return combined
}
