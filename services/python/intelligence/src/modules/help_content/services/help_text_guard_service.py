import re

PERSONAL_DATA_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("[email]", re.compile(r"[\w.%+-]+\s*@\s*[\w-]+\s*\.\s*[a-z]{2,}", re.IGNORECASE)),
    ("[link]", re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)),
    (
        "[amount]",
        re.compile(r"(?:₦|\$|£|€|₵)\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:naira|ngn|usd|gbp|eur|ghs|kes|zar)\b", re.IGNORECASE),
    ),
    ("[number]", re.compile(r"\d(?:[\s().-]*\d){6,}")),
    ("[username]", re.compile(r"(?<![\w@])@[A-Za-z0-9_.]{2,30}")),
)

PLACEHOLDER_WORDS: dict[str, str] = {
    "[link]": "a link",
    "[email]": "your email address",
    "[card number]": "your card",
    "[phone]": "your phone number",
    "[reference]": "the reference",
    "[order number]": "your order",
    "[amount]": "the amount",
    "[ip address]": "your device",
    "[date]": "that date",
    "[address]": "your address",
    "[username]": "the account",
    "[name]": "someone",
    "[number]": "the number",
}


def redact_residual_personal_data(text: str) -> tuple[str, int]:
    total = 0
    for placeholder, pattern in PERSONAL_DATA_PATTERNS:
        text, count = pattern.subn(placeholder, text)
        total += count
    return text, total


def replace_placeholders_with_generic_words(text: str) -> str:
    return re.sub(r"\[[a-z ]+\]", lambda match: PLACEHOLDER_WORDS.get(match.group(0), "it"), text)
