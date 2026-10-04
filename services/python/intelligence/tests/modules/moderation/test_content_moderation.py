from datetime import datetime
from typing import Any

from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from tests.conftest import SignedIntelligenceClient


async def classify(client: SignedIntelligenceClient, text: str, content_type: str = "post") -> dict[str, Any]:
    response = await client.post(
        "/v1/moderation/classify", {"contentId": "content_1", "contentType": content_type, "text": text}
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_clean_text_is_allowed(signed_client: SignedIntelligenceClient) -> None:
    body = await classify(signed_client, "Fresh ankara fabric just arrived, check the store for sizes.")
    assert body["suggestedAction"] == "allow"
    assert body["categories"] == []
    assert body["topCategory"] is None


async def test_scam_text_is_blocked_with_signals(signed_client: SignedIntelligenceClient) -> None:
    body = await classify(signed_client, "Send money first and we double your crypto, guaranteed returns!")
    assert body["topCategory"] == "scam"
    assert body["suggestedAction"] == "block"
    signals = body["categories"][0]["signals"]
    assert "crypto_doubling" in signals
    assert body["classifierSources"] == ["heuristic"]


async def test_threat_and_card_number_detected(signed_client: SignedIntelligenceClient) -> None:
    threat = await classify(signed_client, "I will kill you if you come here")
    assert threat["topCategory"] == "violence"
    card = await classify(signed_client, "my card is 4242 4242 4242 4242 pay me")
    assert any(item["category"] == "personal_data" and item["score"] >= 0.85 for item in card["categories"])


async def test_non_luhn_digits_are_not_card_numbers(signed_client: SignedIntelligenceClient) -> None:
    body = await classify(signed_client, "order ref 1234 5678 9012 3456")
    assert all("payment_card_number" not in item["signals"] for item in body["categories"])


class StubModel:
    version = "stub-v1"

    def classify(self, text: str, _content_type: str) -> dict[str, float]:
        return {"harassment": 0.9} if "stubtrigger" in text else {}


class BrokenModel:
    version = "broken"

    def classify(self, _text: str, _content_type: str) -> dict[str, float]:
        raise RuntimeError("model down")


def build_request(text: str, reference_now: datetime) -> ContentModerationRequest:
    return ContentModerationRequest(content_id="c1", content_type="comment", text=text, now=reference_now)


async def test_pluggable_model_raises_scores_and_failures_fall_back(reference_now: datetime) -> None:
    holder = ModerationModelHolder()
    service = ContentModerationService(holder)
    holder.register_model(StubModel())  # type: ignore[arg-type]
    response = await service.classify_content(build_request("hello stubtrigger", reference_now))
    assert response.top_category == "harassment"
    assert response.classifier_sources == ["heuristic", "model:stub-v1"]
    assert response.metadata.model_version == "stub-v1"
    holder.register_model(BrokenModel())  # type: ignore[arg-type]
    degraded = await service.classify_content(build_request("kill yourself", reference_now))
    assert degraded.suggested_action == "block"
    assert degraded.metadata.degraded is True
    holder.clear_model()
    assert (await service.classify_content(build_request("hello stubtrigger", reference_now))).categories == []
