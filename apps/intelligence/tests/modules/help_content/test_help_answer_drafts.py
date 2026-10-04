from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftRequest
from src.modules.help_content.services.help_answer_drafting_service import draft_help_answer
from tests.conftest import SignedIntelligenceClient


def build_request(**overrides: str) -> HelpAnswerDraftRequest:
    values = {
        "category": "order",
        "subject": "How do I confirm delivery?",
        "question": "Hi there, I got my parcel for [order number]. How do I confirm delivery?",
        "answer": "Hi [name], thanks for waiting. Open Orders. Choose the order. Tap Confirm delivery. Thanks, [name]",
    }
    values.update(overrides)
    return HelpAnswerDraftRequest.model_validate(values)


def test_template_draft_generalises_question_and_numbers_steps() -> None:
    draft = draft_help_answer(build_request())
    assert draft.title == "How do I confirm delivery?"
    assert "1. Open Orders." in draft.answer_markdown
    assert "3. Tap Confirm delivery." in draft.answer_markdown
    assert "[name]" not in draft.answer_markdown
    assert "someone" not in draft.answer_markdown.split("## The answer")[1]
    assert "## Still need help?" in draft.answer_markdown
    assert draft.source == "template"


def test_draft_redacts_personal_data_that_slipped_through() -> None:
    draft = draft_help_answer(
        build_request(question="Email me at amaka@gmail.com or 0803 123 4567, I paid ₦5,000. How long does it take?")
    )
    serialized = draft.model_dump_json()
    assert "amaka@gmail.com" not in serialized
    assert "0803" not in serialized
    assert "5,000" not in serialized
    assert draft.redacted_by_intelligence >= 3


def test_statement_subject_becomes_title_without_question_mark() -> None:
    draft = draft_help_answer(
        build_request(subject="Refund not received after dispute", question="My refund has not arrived.")
    )
    assert draft.title == "Refund not received after dispute"


async def test_endpoint_requires_signature_and_returns_draft(signed_client: SignedIntelligenceClient) -> None:
    payload = {
        "category": "payment",
        "subject": "When do card refunds arrive?",
        "question": "When do card refunds arrive?",
        "answer": "Card refunds can take up to 10 business days.",
    }
    unsigned = await signed_client.http_client.post("/v1/help/answer-drafts", json=payload)
    assert unsigned.status_code == 401
    response = await signed_client.post("/v1/help/answer-drafts", payload)
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "When do card refunds arrive?"
    assert body["answerMarkdown"].startswith("## The question")


async def test_endpoint_rejects_unknown_fields(signed_client: SignedIntelligenceClient) -> None:
    response = await signed_client.post(
        "/v1/help/answer-drafts",
        {"category": "order", "subject": "x", "question": "y", "answer": "z", "email": "a@b.co"},
    )
    assert response.status_code == 422
