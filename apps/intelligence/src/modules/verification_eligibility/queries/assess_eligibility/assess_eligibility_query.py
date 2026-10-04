from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.verification_eligibility.dtos.verification_eligibility_dto import VerificationEligibilityRequest


@dataclass(frozen=True, slots=True)
class AssessVerificationEligibilityQuery(Query):
    query_type: ClassVar[str] = "verificationEligibility.assess"
    request: VerificationEligibilityRequest
