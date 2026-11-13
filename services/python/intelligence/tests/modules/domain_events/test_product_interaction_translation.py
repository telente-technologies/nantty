import json
from datetime import datetime
from typing import Any

import pytest
from pydantic import ValidationError

from src.events.contract_envelope_normalizer import normalize_contract_envelope
from src.events.domain_event_dto import (
    ProductAddedToCartDomainEvent,
    ProductClickedDomainEvent,
    SearchPerformedDomainEvent,
    domain_event_type_adapter,
)
from src.modules.domain_events.services.domain_event_translation_service import translate_to_intelligence_event
from src.services.identifier_hashing_service import OpaqueIdentifierHasher


def interaction_envelope(event_type: str, data: dict[str, Any], occurred_at: datetime) -> dict[str, Any]:
    return {
        "id": f"evt_{event_type.replace('.', '_')}",
        "type": event_type,
        "source": "nantty.catalog",
        "subject": "product_1",
        "schemaVersion": 1,
        "occurredAt": occurred_at.isoformat(),
        "data": data,
    }


def test_search_click_is_forwarded_as_pseudonymous_product_affinity(reference_now: datetime) -> None:
    envelope = interaction_envelope(
        "product.clicked",
        {
            "actorId": "viewer_1",
            "productId": "product_1",
            "storeId": "store_1",
            "surface": "search",
            "queryHash": "q_a1b2c3",
            "resultCount": 8,
            "position": 2,
            "personalized": True,
        },
        reference_now,
    )
    event = domain_event_type_adapter.validate_python(normalize_contract_envelope(envelope))
    assert isinstance(event, ProductClickedDomainEvent)

    translated = translate_to_intelligence_event(event, True, OpaqueIdentifierHasher(b"test-key"))
    assert translated is not None
    assert translated["eventType"] == "searched"
    assert translated["actorId"].startswith("u_")
    assert translated["payload"] == {
        "queryHash": "q_a1b2c3",
        "resultCount": 8,
        "clickedItemId": "product_1",
        "clickedItemType": "product",
        "position": 2,
    }
    assert "viewer_1" not in json.dumps(translated)


def test_mart_product_click_preserves_surface_and_rank_position(reference_now: datetime) -> None:
    envelope = interaction_envelope(
        "product.clicked",
        {
            "actorId": "viewer_1",
            "productId": "product_1",
            "storeId": "store_1",
            "surface": "mart_home",
            "position": 4,
            "personalized": True,
        },
        reference_now,
    )
    event = domain_event_type_adapter.validate_python(normalize_contract_envelope(envelope))
    assert isinstance(event, ProductClickedDomainEvent)

    translated = translate_to_intelligence_event(event, True, OpaqueIdentifierHasher(b"test-key"))
    assert translated is not None
    assert translated["payload"] == {
        "productId": "product_1",
        "storeId": "store_1",
        "position": 4,
        "surface": "mart_home",
    }


def test_product_click_rejects_out_of_range_position(reference_now: datetime) -> None:
    envelope = interaction_envelope(
        "product.clicked",
        {"actorId": "viewer_1", "productId": "product_1", "storeId": "store_1", "position": 10_001},
        reference_now,
    )
    with pytest.raises(ValidationError):
        domain_event_type_adapter.validate_python(normalize_contract_envelope(envelope))


def test_cart_add_is_forwarded_only_with_personalization_consent(reference_now: datetime) -> None:
    envelope = interaction_envelope(
        "product.addedToCart",
        {"actorId": "viewer_1", "productId": "product_1", "storeId": "store_1", "quantity": 2},
        reference_now,
    )
    event = domain_event_type_adapter.validate_python(normalize_contract_envelope(envelope))
    assert isinstance(event, ProductAddedToCartDomainEvent)
    assert translate_to_intelligence_event(event, False, OpaqueIdentifierHasher(b"test-key")) is None
    translated = translate_to_intelligence_event(event, True, OpaqueIdentifierHasher(b"test-key"))
    assert translated is not None
    assert translated["eventType"] == "added_to_cart"
    assert translated["payload"]["quantity"] == 2


def test_search_query_event_does_not_forward_search_text(reference_now: datetime) -> None:
    envelope = interaction_envelope(
        "search.performed",
        {"actorId": "viewer_1", "queryHash": "q_a1b2c3", "resultCount": 3},
        reference_now,
    )
    event = domain_event_type_adapter.validate_python(normalize_contract_envelope(envelope))
    assert isinstance(event, SearchPerformedDomainEvent)
    translated = translate_to_intelligence_event(event, True, OpaqueIdentifierHasher(b"test-key"))
    assert translated is not None
    assert translated["eventType"] == "searched"
    assert translated["payload"] == {"queryHash": "q_a1b2c3", "resultCount": 3}
