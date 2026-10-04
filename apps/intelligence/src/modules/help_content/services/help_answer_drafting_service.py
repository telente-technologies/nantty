import re
from collections import Counter

from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftRequest, HelpAnswerDraftResponse
from src.modules.help_content.services.help_text_guard_service import (
    redact_residual_personal_data,
    replace_placeholders_with_generic_words,
)

GREETING = re.compile(
    r"^(?:hi|hello|hey|dear|good\s+(?:morning|afternoon|evening|day)|greetings)\b[^.!?\n]*[,.!]?\s*", re.IGNORECASE
)
SIGN_OFF = re.compile(
    r"(?:^|\s)(?:thanks|thank you|many thanks|regards|kind regards|best regards|cheers|sincerely)\b[^.!?]*(?:[.!?]|$)",
    re.IGNORECASE,
)
FILLER = re.compile(
    r"^(?:sorry for the (?:wait|delay)|thanks for (?:waiting|your patience|reaching out)"
    r"|i hope you(?: are|'re) well)[^.!?]*[.!?]?\s*",
    re.IGNORECASE,
)
STEP_VERB = re.compile(
    r"^(?:go to|open|tap|click|select|choose|press|enter|upload|add|turn on|turn off|switch|scroll|find"
    r"|sign in|update|check|confirm)\b",
    re.IGNORECASE,
)
INTERROGATIVE = re.compile(
    r"^(?:how|what|why|when|where|who|which|can|could|do|does|did|is|are|will|should|would|may)\b", re.IGNORECASE
)
STILL_NEED_HELP = (
    "If this does not solve it, open Help centre and choose Contact support. "
    "Tell us what you have already tried so we can help faster."
)
STOP_WORD_TEXT = (
    "a an the and or but if to of in on at by for with from is are was were be been i me my we our you your it its this"
    " that how what why when where can do does did have has had please help not no yes just still also get got any"
)
STOP_WORDS = frozenset(STOP_WORD_TEXT.split())


def strip_conversational_noise(text: str) -> str:
    lines = [FILLER.sub("", GREETING.sub("", line)) for line in text.splitlines()]
    return re.sub(r"[ \t]{2,}", " ", SIGN_OFF.sub(" ", "\n".join(lines))).strip()


def split_sentences(text: str) -> list[str]:
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])", re.sub(r"\s+", " ", text))
        if len(sentence.strip()) > 1
    ]


def clamp_at_word(text: str, maximum: int) -> str:
    if len(text) <= maximum:
        return text
    return re.sub(r"\s+\S*$", "", text[:maximum]).rstrip(",;:") + "…"


def build_title(subject: str, question: str) -> str:
    asked = next(
        (
            sentence
            for sentence in split_sentences(question)
            if sentence.endswith("?") and len(sentence) <= 120 and len(sentence.split()) >= 3
        ),
        None,
    )
    cleaned_subject = re.sub(r"\s+", " ", subject).strip().rstrip(".!")
    chosen = asked or (cleaned_subject.rstrip("?") + "?" if INTERROGATIVE.match(cleaned_subject) else cleaned_subject)
    chosen = chosen or "A question from our community"
    return clamp_at_word(chosen[0].upper() + chosen[1:], 90)


def format_answer(sentences: list[str]) -> str:
    steps = [sentence for sentence in sentences if STEP_VERB.match(sentence) or " > " in sentence]
    if len(steps) >= 2:
        intro = " ".join(sentence for sentence in sentences if sentence not in steps)
        numbered = "\n".join(f"{index}. {step[0].upper()}{step[1:]}" for index, step in enumerate(steps, start=1))
        return f"{intro}\n\n{numbered}".strip()
    return "\n\n".join(" ".join(sentences[index : index + 3]) for index in range(0, len(sentences), 3))


def rank_keywords(text: str, limit: int) -> list[str]:
    words = [word for word in re.findall(r"[a-z]{3,}", text.lower()) if word not in STOP_WORDS]
    return [word for word, _count in sorted(Counter(words).items(), key=lambda pair: (-pair[1], pair[0]))[:limit]]


def draft_help_answer(request: HelpAnswerDraftRequest) -> HelpAnswerDraftResponse:
    subject, subject_redactions = redact_residual_personal_data(request.subject)
    question_text, question_redactions = redact_residual_personal_data(request.question)
    answer_text, answer_redactions = redact_residual_personal_data(request.answer)
    question = replace_placeholders_with_generic_words(strip_conversational_noise(question_text))
    answer_sentences = split_sentences(replace_placeholders_with_generic_words(strip_conversational_noise(answer_text)))
    title = build_title(replace_placeholders_with_generic_words(subject), question)
    summary = clamp_at_word(
        answer_sentences[0] if answer_sentences else "Here is what our support team explained.", 160
    )
    markdown = "\n\n".join(
        [
            "## The question",
            clamp_at_word(re.sub(r"\s+", " ", question), 600) or title,
            "## The answer",
            format_answer(answer_sentences) or summary,
            "## Still need help?",
            STILL_NEED_HELP,
        ]
    )
    return HelpAnswerDraftResponse(
        title=title,
        summary=summary,
        question=title,
        answer_markdown=markdown,
        tags=rank_keywords(f"{subject} {question} {' '.join(answer_sentences)}", 5),
        source="template",
        redacted_by_intelligence=subject_redactions + question_redactions + answer_redactions,
    )


class HelpAnswerDraftingService:
    async def draft(self, request: HelpAnswerDraftRequest) -> HelpAnswerDraftResponse:
        return draft_help_answer(request)
