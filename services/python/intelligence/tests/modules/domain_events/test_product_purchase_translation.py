import json
from datetime import datetime
from typing import Any

from src.events.contract_envelope_normalizer import normalize_contract_envelope
from src.events.domain_event_dto import ProductPurchasedDomainEvent, domain_event_type_adapter
from src.modules.domain_events.services.domain_event_translation_service import translate_to_intelligence_event
from src.services.identifier_hashing_service import OpaqueIdentifierHasher


def purchase_envelope(data: dict[str, Any], occurred_at: datetime) -> dict[str, Any]:
    return {
        "id": "evt_purchase_1",
        "type": "product.purchased",
        "source": "zudomart.orders",
        "subject": "product_1",
        "schemaVersion": 1,
        "occurredAt": occurred_at.isoformat(),
        "data": data,
    }


def purchase_data(**extra: Any) -> dict[str, Any]:
    return {
        "productId": "product_1",
        "storeId": "store_1",
        "variantId": "variant_1",
        "quantity": 2,
        "orderGroupId": "order_1",
        "personalized": True,
        "unitPrice": {"amountMinor": 450000, "currency": "NGN"},
        **extra,
    }


def test_a_personalised_purchase_becomes_a_hashed_purchased_event(reference_now: datetime) -> None:
    body = normalize_contract_envelope(
        purchase_envelope(purchase_data(actorId="buyer_1", sourcePostId="post_9"), reference_now)
    )
    event = domain_event_type_adapter.validate_python(body)
    assert isinstance(event, ProductPurchasedDomainEvent)
    hasher = OpaqueIdentifierHasher(b"k" * 32)
    translated = translate_to_intelligence_event(event, True, hasher)
    assert translated is not None
    assert translated["eventType"] == "purchased"
    assert translated["actorId"] == hasher.hash_user_id("buyer_1")
    assert translated["payload"]["orderId"] == "order_1"
    assert translated["payload"]["sourcePostId"] == "post_9"
    assert translated["payload"]["items"] == [
        {"productId": "product_1", "quantity": 2, "unitPrice": {"amountMinor": 450000, "currency": "NGN"}}
    ]
    assert "buyer_1" not in json.dumps(translated)


def test_purchases_without_personalisation_consent_are_not_forwarded(reference_now: datetime) -> None:
    body = normalize_contract_envelope(purchase_envelope(purchase_data(actorId="buyer_2"), reference_now))
    event = domain_event_type_adapter.validate_python(body)
    assert translate_to_intelligence_event(event, False, OpaqueIdentifierHasher(b"k" * 32)) is None


async def test_an_anonymous_purchase_is_skipped_not_attributed_or_dead_lettered(
    application_container: Any, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    body = json.dumps(purchase_envelope(purchase_data(personalized=False), reference_now))
    assert (await consumer.process_message_body(body)).status == "skipped_unattributed"
