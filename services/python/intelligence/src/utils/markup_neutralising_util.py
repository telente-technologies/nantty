import re

MARKUP_CHARACTER_PATTERN = re.compile(r"[<>`\[\]{}]")


def neutralise_markup(text: str) -> str:
    return MARKUP_CHARACTER_PATTERN.sub("", text)
