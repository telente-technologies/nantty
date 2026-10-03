from src.modules.extended_risk.dtos.extended_risk_dto import ExtendedRiskRequest, ExtendedRiskResponse
from src.modules.extended_risk.queries.score_extended_risk_subject.score_extended_risk_subject_query import (
    ScoreExtendedRiskSubjectQuery,
)
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class ExtendedRiskController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def score_extended_risk_subject(self, request: ExtendedRiskRequest) -> ExtendedRiskResponse:
        response: ExtendedRiskResponse = await run_within_request_deadline(
            self.query_bus.execute(ScoreExtendedRiskSubjectQuery(request)), self.deadline_seconds
        )
        return response
