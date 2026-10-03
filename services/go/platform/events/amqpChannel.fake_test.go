package events

import (
	"context"
	"errors"
	"sync"

	amqp "github.com/rabbitmq/amqp091-go"
)

type recordedPublish struct {
	exchange   string
	routingKey string
	mandatory  bool
	publishing amqp.Publishing
}

type fakeAmqpChannel struct {
	mutex            sync.Mutex
	published        []recordedPublish
	confirmMode      bool
	confirms         chan amqp.Confirmation
	returns          chan amqp.Return
	deliveryTag      uint64
	nackEveryPublish bool
	failPublishing   error
	unroutableKeys   map[string]bool
	deliveries       chan amqp.Delivery
	prefetch         int
	cancelledTags    []string
	closed           bool
}

func newFakeAmqpChannel() *fakeAmqpChannel {
	return &fakeAmqpChannel{deliveries: make(chan amqp.Delivery, 16), unroutableKeys: map[string]bool{}}
}

func (channel *fakeAmqpChannel) PublishWithContext(_ context.Context, exchange, key string, mandatory, _ bool, msg amqp.Publishing) error {
	channel.mutex.Lock()
	defer channel.mutex.Unlock()
	if channel.failPublishing != nil {
		return channel.failPublishing
	}
	channel.published = append(channel.published, recordedPublish{exchange: exchange, routingKey: key, mandatory: mandatory, publishing: msg})
	channel.deliveryTag++
	if mandatory && channel.unroutableKeys[key] && channel.returns != nil {
		channel.returns <- amqp.Return{Exchange: exchange, RoutingKey: key, MessageId: msg.MessageId, ReplyText: "NO_ROUTE"}
	}
	if channel.confirmMode && channel.confirms != nil {
		channel.confirms <- amqp.Confirmation{DeliveryTag: channel.deliveryTag, Ack: !channel.nackEveryPublish}
	}
	return nil
}

func (channel *fakeAmqpChannel) Confirm(bool) error {
	channel.confirmMode = true
	return nil
}

func (channel *fakeAmqpChannel) NotifyPublish(confirm chan amqp.Confirmation) chan amqp.Confirmation {
	channel.confirms = confirm
	return confirm
}

func (channel *fakeAmqpChannel) NotifyReturn(returns chan amqp.Return) chan amqp.Return {
	channel.returns = returns
	return returns
}

func (channel *fakeAmqpChannel) Qos(prefetchCount, _ int, _ bool) error {
	channel.prefetch = prefetchCount
	return nil
}

func (channel *fakeAmqpChannel) ConsumeWithContext(context.Context, string, string, bool, bool, bool, bool, amqp.Table) (<-chan amqp.Delivery, error) {
	return channel.deliveries, nil
}

func (channel *fakeAmqpChannel) Cancel(consumer string, _ bool) error {
	channel.mutex.Lock()
	defer channel.mutex.Unlock()
	channel.cancelledTags = append(channel.cancelledTags, consumer)
	return nil
}

func (channel *fakeAmqpChannel) Close() error {
	channel.mutex.Lock()
	defer channel.mutex.Unlock()
	channel.closed = true
	return nil
}

func (channel *fakeAmqpChannel) IsClosed() bool {
	channel.mutex.Lock()
	defer channel.mutex.Unlock()
	return channel.closed
}

func (channel *fakeAmqpChannel) publishedMessages() []recordedPublish {
	channel.mutex.Lock()
	defer channel.mutex.Unlock()
	return append([]recordedPublish(nil), channel.published...)
}

type fakeChannelOpener struct {
	mutex    sync.Mutex
	channels []*fakeAmqpChannel
	opened   int
}

func (opener *fakeChannelOpener) OpenChannel(ctx context.Context) (amqpChannel, error) {
	opener.mutex.Lock()
	defer opener.mutex.Unlock()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	opener.opened++
	if len(opener.channels) == 0 {
		return newFakeAmqpChannel(), nil
	}
	next := opener.channels[0]
	opener.channels = opener.channels[1:]
	return next, nil
}

type settlement struct {
	tag     uint64
	acked   bool
	requeue bool
}

type fakeAcknowledger struct {
	mutex       sync.Mutex
	settlements []settlement
	settled     chan settlement
}

func newFakeAcknowledger() *fakeAcknowledger {
	return &fakeAcknowledger{settled: make(chan settlement, 16)}
}

func (acknowledger *fakeAcknowledger) record(entry settlement) error {
	acknowledger.mutex.Lock()
	acknowledger.settlements = append(acknowledger.settlements, entry)
	acknowledger.mutex.Unlock()
	acknowledger.settled <- entry
	return nil
}

func (acknowledger *fakeAcknowledger) Ack(tag uint64, _ bool) error {
	return acknowledger.record(settlement{tag: tag, acked: true})
}

func (acknowledger *fakeAcknowledger) Nack(tag uint64, _ bool, requeue bool) error {
	return acknowledger.record(settlement{tag: tag, requeue: requeue})
}

func (acknowledger *fakeAcknowledger) Reject(tag uint64, requeue bool) error {
	return acknowledger.record(settlement{tag: tag, requeue: requeue})
}

type fakeRetrySink struct {
	mutex     sync.Mutex
	published []outgoingMessage
	failWith  error
}

func (sink *fakeRetrySink) publishConfirmed(_ context.Context, messages []outgoingMessage) error {
	sink.mutex.Lock()
	defer sink.mutex.Unlock()
	if sink.failWith != nil {
		return sink.failWith
	}
	sink.published = append(sink.published, messages...)
	return nil
}

func (sink *fakeRetrySink) Close() error { return nil }

var errHandlerFailed = errors.New("downstream unavailable")
