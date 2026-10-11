import re
from collections import Counter

from src.constants.trend_category_taxonomy_constant import TrendCategory
from src.utils.markup_neutralising_util import neutralise_markup

URL_PATTERN = re.compile(r"https?://\S+|www\.\S+")
MENTION_PATTERN = re.compile(r"@\w+")
HASHTAG_PATTERN = re.compile(r"#(\w+)")
PICTOGRAPH_PATTERN = re.compile("[\U0001f000-\U0001faff☀-➿️‍]+")
REPEATED_PUNCTUATION_PATTERN = re.compile(r"([!?.])\1+")
WORD_PATTERN = re.compile(r"[a-z0-9']+")
SENSATIONAL_PATTERN = re.compile(
    r"\b(breaking|shocking|omg|unbelievable|must see|you won't believe|viral|wow)\b[:!]*\s*", re.IGNORECASE
)
STOPWORDS = frozenset(
    [
        "a",
        "an",
        "the",
        "and",
        "or",
        "but",
        "if",
        "of",
        "to",
        "in",
        "on",
        "at",
        "for",
        "with",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "it",
        "this",
        "that",
        "these",
        "those",
        "i",
        "you",
        "we",
        "they",
        "he",
        "she",
        "my",
        "our",
        "your",
        "their",
        "me",
        "us",
        "them",
        "so",
        "just",
        "not",
        "no",
        "do",
        "does",
        "did",
        "have",
        "has",
        "had",
        "will",
        "would",
        "can",
        "could",
    ]
)
MAXIMUM_TITLE_LENGTH = 90
MINIMUM_TITLE_LENGTH = 12
NEUTRAL_TEMPLATE_CATEGORIES: frozenset[TrendCategory] = frozenset({"politics", "religion"})


def clean_post_text_for_headline(text: str) -> str:
    cleaned = URL_PATTERN.sub("", neutralise_markup(text))
    cleaned = MENTION_PATTERN.sub("", cleaned)
    cleaned = PICTOGRAPH_PATTERN.sub("", cleaned)
    cleaned = SENSATIONAL_PATTERN.sub("", cleaned)
    cleaned = HASHTAG_PATTERN.sub(lambda match: match.group(1), cleaned)
    cleaned = REPEATED_PUNCTUATION_PATTERN.sub(r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:|")
    if cleaned.isupper():
        cleaned = cleaned.capitalize()
    return cleaned.replace("!", ".")


def first_sentence(text: str) -> str:
    parts = re.split(r"(?<=[.?])\s+", text, maxsplit=1)
    return parts[0].rstrip(".") if parts else ""


def truncate_at_word_boundary(text: str, maximum_length: int) -> str:
    if len(text) <= maximum_length:
        return text
    shortened = text[:maximum_length].rsplit(" ", 1)[0]
    return f"{shortened.rstrip(',;:')}…"


def tokenise(text: str) -> list[str]:
    return [token for token in WORD_PATTERN.findall(text.lower()) if token not in STOPWORDS and len(token) > 2]


def select_most_central_text(texts: list[str]) -> str:
    term_counts: Counter[str] = Counter(token for text in texts for token in set(tokenise(text)))
    best_text = ""
    best_score = -1.0
    for text in texts:
        tokens = set(tokenise(text))
        if not tokens:
            continue
        score = sum(term_counts[token] for token in tokens) / (len(tokens) ** 0.5)
        if score > best_score or (score == best_score and text < best_text):
            best_score, best_text = score, text
    return best_text


def build_template_headline_title(story_key: str) -> str:
    return f"People are posting about #{story_key}"


def build_extractive_headline_title(texts: list[str], story_key: str, category: TrendCategory) -> tuple[str, bool]:
    if category in NEUTRAL_TEMPLATE_CATEGORIES:
        return build_template_headline_title(story_key), False
    sentence = first_sentence(clean_post_text_for_headline(select_most_central_text(texts)))
    if len(sentence) < MINIMUM_TITLE_LENGTH:
        return build_template_headline_title(story_key), False
    return truncate_at_word_boundary(sentence, MAXIMUM_TITLE_LENGTH), True


def build_headline_summary(post_count: int, author_count: int, window_hours: int, related_hashtags: list[str]) -> str:
    accounts = "account" if author_count == 1 else "accounts"
    summary = f"{post_count} public posts from {author_count} {accounts} in the last {window_hours} hours."
    if related_hashtags:
        summary += " Related: " + ", ".join(f"#{tag}" for tag in related_hashtags[:3]) + "."
    return summary
