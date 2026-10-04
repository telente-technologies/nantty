import json
from datetime import datetime

from src.container import ApplicationContainer


async def test_contract_follow_and_block_envelopes_are_accepted(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    follow_created = {
        "id": "evt_contract_follow",
        "type": "follow.created",
        "source": "social",
        "subject": "follow_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {"followId": "follow_1", "followerId": "fan_1", "followeeId": "creator_1", "state": "accepted"},
    }
    block_created = {
        "id": "evt_contract_block",
        "type": "block.created",
        "source": "social",
        "subject": "fan_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {"blockerId": "fan_1", "blockedId": "spammer_1"},
    }
    assert (await consumer.process_message_body(json.dumps(follow_created))).status == "processed"
    assert (await consumer.process_message_body(json.dumps(block_created))).status == "processed"


async def test_contract_report_and_message_envelopes_are_accepted(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    report_created = {
        "id": "evt_contract_report",
        "type": "report.created",
        "source": "social",
        "subject": "report_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {
            "reportId": "report_1",
            "reporterId": "fan_2",
            "targetType": "post",
            "targetId": "post_2",
            "reportedUserId": "author_2",
            "reason": "fraud",
        },
    }
    message_sent = {
        "id": "evt_contract_message",
        "type": "message.sent",
        "source": "social",
        "subject": "conversation_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {
            "messageId": "message_1",
            "senderId": "fan_2",
            "recipientIds": ["author_2"],
            "conversationId": "conversation_1",
            "kind": "text",
        },
    }
    assert (await consumer.process_message_body(json.dumps(report_created))).status == "processed"
    assert (await consumer.process_message_body(json.dumps(message_sent))).status == "processed"
