import re

from src.modules.moderation.dtos.content_moderation_dto import ModerationCategory

type SignalRule = tuple[str, float, re.Pattern[str]]


def compile_rule(code: str, weight: float, pattern: str) -> SignalRule:
    return code, weight, re.compile(pattern, re.IGNORECASE)


CATEGORY_RULES: dict[ModerationCategory, tuple[SignalRule, ...]] = {
    "scam": (
        compile_rule("advance_fee_request", 0.7, r"\b(send|pay)\b.{0,30}\b(first|upfront|in advance)\b"),
        compile_rule("guaranteed_returns", 0.7, r"\b(guaranteed|100%)\b.{0,20}\b(returns?|profit|income)\b"),
        compile_rule("crypto_doubling", 0.8, r"\b(double|triple)\b.{0,20}\b(your )?(money|crypto|btc|investment)\b"),
        compile_rule(
            "off_platform_payment", 0.5, r"\b(pay|transfer|send)\b.{0,25}\b(outside|off)\b.{0,10}\b(app|platform)\b"
        ),
        compile_rule("wire_service", 0.4, r"\b(western union|moneygram|gift ?card codes?)\b"),
        compile_rule("urgency_pressure", 0.25, r"\b(act now|last chance|only \d+ left|hurry)\b"),
    ),
    "spam": (
        compile_rule("repeated_character_run", 0.3, r"(.)\1{9,}"),
        compile_rule("follow_for_follow", 0.5, r"\b(f4f|follow ?4 ?follow|sub ?4 ?sub|follow back)\b"),
        compile_rule("many_links", 0.5, r"(https?://\S+.*){3,}"),
        compile_rule("repeated_word_block", 0.4, r"\b(\w{3,})\b(?:\W+\1\b){4,}"),
        compile_rule(
            "contact_harvesting", 0.4, r"\b(dm|whatsapp|telegram)\b.{0,20}\b(me|us)\b.{0,20}\b(now|to (buy|order))\b"
        ),
    ),
    "harassment": (
        compile_rule("self_harm_taunt", 0.9, r"\bkill yourself\b|\bkys\b"),
        compile_rule("direct_insult", 0.5, r"\byou(?:'re| are)\b.{0,12}\b(stupid|idiot|worthless|useless|ugly)\b"),
    ),
    "violence": (
        compile_rule("explicit_threat", 0.85, r"\bi(?:'ll| will| am going to)\b.{0,15}\b(kill|stab|shoot|hurt|beat)\b"),
        compile_rule("weapon_sale", 0.6, r"\b(selling|for sale)\b.{0,20}\b(gun|firearm|rifle|pistol|ammo)\b"),
    ),
    "prohibited_goods": (
        compile_rule(
            "counterfeit_claim", 0.6, r"\b(1:1|AAA|mirror quality|replica)\b.{0,20}\b(copy|brand|designer|watch|bag)\b"
        ),
        compile_rule(
            "controlled_substance", 0.8, r"\b(cocaine|heroin|meth|mdma|tramadol)\b.{0,20}\b(for sale|buy|available)\b"
        ),
        compile_rule("stolen_goods", 0.7, r"\b(stolen|hot) (phones?|goods|cards?)\b"),
    ),
    "personal_data": (
        compile_rule("phone_number", 0.3, r"(?<!\d)(\+?\d[\d\s\-]{9,14}\d)(?!\d)"),
        compile_rule("email_address", 0.3, r"[\w.+-]+@[\w-]+\.[\w.]+"),
    ),
}


def passes_luhn_checksum(digits: str) -> bool:
    total = 0
    for index, character in enumerate(reversed(digits)):
        value = int(character)
        if index % 2 == 1:
            value = value * 2 - 9 if value * 2 > 9 else value * 2
        total += value
    return total % 10 == 0


def contains_payment_card_number(text: str) -> bool:
    for candidate in re.findall(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)", text):
        digits = re.sub(r"\D", "", candidate)
        if 13 <= len(digits) <= 19 and passes_luhn_checksum(digits):
            return True
    return False


def calculate_uppercase_ratio(text: str) -> float:
    letters = [character for character in text if character.isalpha()]
    if len(letters) < 20:
        return 0.0
    return sum(1 for character in letters if character.isupper()) / len(letters)


def evaluate_text_heuristics(text: str) -> dict[ModerationCategory, tuple[float, list[str]]]:
    results: dict[ModerationCategory, tuple[float, list[str]]] = {}
    for category, rules in CATEGORY_RULES.items():
        matched = [(code, weight) for code, weight, pattern in rules if pattern.search(text)]
        if category == "personal_data" and contains_payment_card_number(text):
            matched.append(("payment_card_number", 0.9))
        if category == "spam" and calculate_uppercase_ratio(text) >= 0.8:
            matched.append(("shouting_text", 0.25))
        if matched:
            no_match_probability = 1.0
            for _code, weight in matched:
                no_match_probability *= 1.0 - weight
            results[category] = (1.0 - no_match_probability, sorted(code for code, _weight in matched))
    return results
