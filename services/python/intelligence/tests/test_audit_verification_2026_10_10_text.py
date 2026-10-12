import pytest

from src.modules.clips.services.exploration_sampling_service import calculate_exploration_slot_positions
from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftRequest
from src.modules.help_content.services.help_answer_drafting_service import draft_help_answer
from src.modules.trending.services.headline_text_service import clean_post_text_for_headline


def test_help_drafts_and_headlines_strip_markup() -> None:
    draft = draft_help_answer(
        HelpAnswerDraftRequest(
            category="payments",
            subject="<script>alert(1)</script> refund",
            question="How do I get a refund? [click](javascript:alert(1))",
            answer="Open the order and tap refund. <img src=x onerror=alert(1)>",
        )
    )
    rendered = f"{draft.title} {draft.answer_markdown}"
    assert "<" not in rendered
    assert ">" not in rendered
    assert "](" not in rendered
    assert "<" not in clean_post_text_for_headline("<img src=x onerror=alert(1)> big sale today")


@pytest.mark.parametrize(
    ("limit", "share", "expected"),
    [(10, 0.2, 2), (10, 0.9, 5), (4, 0.2, 1), (3, 0.1, 0)],
)
def test_exploration_slots_match_the_requested_share(limit: int, share: float, expected: int) -> None:
    assert len(calculate_exploration_slot_positions(limit, share)) == expected
