#!/usr/bin/env bash
set -euo pipefail
topic_arn=$(awslocal sns create-topic --name zudomart-domain-events --query TopicArn --output text)

create_queue_with_dead_letter_queue() {
  local name="$1"
  local dlq_url dlq_arn
  dlq_url=$(awslocal sqs create-queue --queue-name "${name}-dlq" --query QueueUrl --output text)
  dlq_arn=$(awslocal sqs get-queue-attributes --queue-url "$dlq_url" --attribute-names QueueArn --query Attributes.QueueArn --output text)
  awslocal sqs create-queue --queue-name "$name" \
    --attributes "{\"VisibilityTimeout\":\"60\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"${dlq_arn}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"}" \
    --query QueueUrl --output text
}

for job_queue in jobs-email jobs-media jobs-reports jobs-payouts jobs-search-indexing; do
  create_queue_with_dead_letter_queue "$job_queue" >/dev/null
done

for consumer in users-domain-events notifications-domain-events realtime-domain-events intelligence-domain-events; do
  queue_url=$(create_queue_with_dead_letter_queue "$consumer")
  queue_arn=$(awslocal sqs get-queue-attributes --queue-url "$queue_url" --attribute-names QueueArn --query Attributes.QueueArn --output text)
  awslocal sns subscribe --topic-arn "$topic_arn" --protocol sqs --notification-endpoint "$queue_arn" --attributes RawMessageDelivery=true >/dev/null
done

touch /tmp/zudomart-messaging-ready
