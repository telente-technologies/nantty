from typing import Any

from src.events.contract_envelope_normalizer import normalize_contract_envelope
from src.events.domain_event_dto import ContentSavedDomainEvent, domain_event_type_adapter


def social_content_saved(kind: str) -> dict[str, Any]:
    return {
        "id": "9739a346-a8b0-4f32-ae22-73942b7ebbf9",
        "type": "content.saved",
        "occurredAt": "2026-10-11T13:01:41Z",
        "source": "social",
        "subject": "01a12ad7-1577-727a-916f-68f74ec8529e",
        "schemaVersion": 1,
        "data": {
            "kind": kind,
            "postId": "01a12ad7-1577-727a-916f-68f74ec8529e",
            "topics": [],
            "actorId": "01a12ad7-12c4-79d6-b258-d0a2edfad072",
            "hashtags": [],
            "targetId": "01a12ad7-1577-727a-916f-68f74ec8529e",
            "targetType": "post",
            "postAuthorId": "01a12ad7-125b-7546-8596-000000000001",
        },
    }


def test_the_content_saved_event_social_publishes_validates() -> None:
    for kind, expected_type in (("post", "post"), ("clip", "clip")):
        event = domain_event_type_adapter.validate_python(normalize_contract_envelope(social_content_saved(kind)))
        assert isinstance(event, ContentSavedDomainEvent)
        assert event.actor_id == "01a12ad7-12c4-79d6-b258-d0a2edfad072"
        assert event.payload.target_type == expected_type
        assert event.payload.author_id == "01a12ad7-125b-7546-8596-000000000001"
