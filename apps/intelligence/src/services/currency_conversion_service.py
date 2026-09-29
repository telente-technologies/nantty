from collections.abc import Sequence
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

from src.dtos.common_dto import ExchangeRateToUsd, MoneyAmount

MICROS_PER_UNIT = Decimal(1_000_000)
MINOR_UNIT_EXPONENT_OVERRIDES: dict[str, int] = {
    "JPY": 0,
    "KRW": 0,
    "XOF": 0,
    "XAF": 0,
    "UGX": 0,
    "RWF": 0,
    "KWD": 3,
    "BHD": 3,
    "OMR": 3,
    "TND": 3,
}
DEFAULT_MINOR_UNIT_EXPONENT = 2


class CurrencyMismatchError(ValueError):
    pass


def find_minor_unit_exponent(currency: str) -> int:
    return MINOR_UNIT_EXPONENT_OVERRIDES.get(currency, DEFAULT_MINOR_UNIT_EXPONENT)


def build_usd_rate_lookup(exchange_rates: Sequence[ExchangeRateToUsd]) -> dict[str, Decimal]:
    rate_lookup = {rate.currency: rate.usd_per_major_unit for rate in exchange_rates}
    rate_lookup.setdefault("USD", Decimal(1))
    return rate_lookup


def convert_money_to_usd_micros(money: MoneyAmount, usd_rate_lookup: dict[str, Decimal]) -> Decimal | None:
    usd_per_major_unit = usd_rate_lookup.get(money.currency)
    if usd_per_major_unit is None:
        return None
    major_amount = Decimal(money.amount_minor).scaleb(-find_minor_unit_exponent(money.currency))
    return major_amount * usd_per_major_unit * MICROS_PER_UNIT


def convert_usd_micros_to_minor_amount(
    usd_micros: Decimal, currency: str, usd_rate_lookup: dict[str, Decimal], round_up: bool
) -> int | None:
    usd_per_major_unit = usd_rate_lookup.get(currency)
    if usd_per_major_unit is None:
        return None
    major_amount = usd_micros / MICROS_PER_UNIT / usd_per_major_unit
    minor_amount = major_amount.scaleb(find_minor_unit_exponent(currency))
    rounding_mode = ROUND_CEILING if round_up else ROUND_FLOOR
    return int(minor_amount.to_integral_value(rounding=rounding_mode))


def ensure_same_currency(*amounts: MoneyAmount | None) -> str:
    currencies = {amount.currency for amount in amounts if amount is not None}
    if len(currencies) != 1:
        raise CurrencyMismatchError("amounts use different currencies")
    return currencies.pop()
