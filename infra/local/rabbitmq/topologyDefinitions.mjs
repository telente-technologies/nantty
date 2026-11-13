const exchanges = { events: "nantty.events", unrouted: "nantty.unrouted", jobs: "nantty.jobs", retry: "nantty.retry", deadLetter: "nantty.dlx" };
const unroutedQueue = "unrouted-events";

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const anyOf = (values) => (values.length === 0 ? "^$" : `^(${values.map(escape).join("|")})$`);

const queue = (name, vhost, args) => ({ name, vhost, durable: true, auto_delete: false, arguments: { "x-queue-type": "quorum", ...args } });
const exchange = (name, vhost, type, args = {}) => ({ name, vhost, type, durable: true, auto_delete: false, internal: false, arguments: args });
const binding = (source, destination, vhost, routingKey) => ({ source, vhost, destination, destination_type: "queue", routing_key: routingKey, arguments: {} });

export function buildRabbitMQTopologyDefinitions(topology) {
  const vhost = topology.vhost;
  const queues = [queue(unroutedQueue, vhost, { "x-message-ttl": topology.unroutedRetentionMs, "x-max-length": 100000, "x-overflow": "drop-head" })];
  const bindings = [binding(exchanges.unrouted, unroutedQueue, vhost, "")];

  function declareQueueWithRetriesAndDeadLetter(name) {
    const safety = { "x-dead-letter-strategy": "at-least-once", "x-overflow": "reject-publish" };
    queues.push(queue(name, vhost, { ...safety, "x-dead-letter-exchange": exchanges.deadLetter, "x-dead-letter-routing-key": `${name}.dlq` }));
    queues.push(queue(`${name}.dlq`, vhost, {}));
    bindings.push(binding(exchanges.deadLetter, `${name}.dlq`, vhost, `${name}.dlq`));
    bindings.push(binding(exchanges.retry, name, vhost, name));
    for (const [tier, ttl] of Object.entries(topology.retryTiers)) {
      const retryQueue = `${name}.retry.${tier}`;
      queues.push(queue(retryQueue, vhost, { ...safety, "x-message-ttl": ttl, "x-dead-letter-exchange": exchanges.retry, "x-dead-letter-routing-key": name }));
      bindings.push(binding(exchanges.retry, retryQueue, vhost, retryQueue));
    }
  }

  for (const [name, routingKeys] of Object.entries(topology.eventQueues)) {
    declareQueueWithRetriesAndDeadLetter(name);
    for (const routingKey of routingKeys) bindings.push(binding(exchanges.events, name, vhost, routingKey));
  }
  for (const name of topology.jobQueues) {
    declareQueueWithRetriesAndDeadLetter(name);
    bindings.push(binding(exchanges.jobs, name, vhost, name));
  }

  const declaredQueues = new Set(queues.map((entry) => entry.name));
  const servicePermissions = Object.entries(topology.services).map(([name, grants]) => {
    const consumes = grants.consumes ?? [];
    for (const queueName of consumes) {
      if (!declaredQueues.has(queueName)) throw new Error(`${name} consumes undeclared queue ${queueName}`);
    }
    const writes = [
      ...(grants.publishesEvents ? [exchanges.events] : []),
      ...(grants.enqueuesJobs ? [exchanges.jobs] : []),
      ...(consumes.length > 0 ? [exchanges.retry] : []),
    ];
    return {
      user: name,
      vhost,
      configure: "^$",
      write: anyOf(writes),
      read: anyOf(consumes),
      topicPermission: {
        user: name,
        vhost,
        exchange: exchanges.retry,
        write: consumes.length === 0 ? "^$" : `^(${consumes.map(escape).join("|")})\\.retry\\.`,
        read: "^$",
        configure: "^$",
      },
    };
  });

  return {
    vhost,
    exchanges: [
      exchange(exchanges.events, vhost, "topic", { "alternate-exchange": exchanges.unrouted }),
      exchange(exchanges.unrouted, vhost, "fanout"),
      exchange(exchanges.jobs, vhost, "direct"),
      exchange(exchanges.retry, vhost, "topic"),
      exchange(exchanges.deadLetter, vhost, "direct"),
    ],
    queues,
    bindings,
    servicePermissions,
  };
}

export const rabbitMQExchangeNames = exchanges;
