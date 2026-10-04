from src.modules.risk.dtos.risk_scoring_dto import RiskScoringRequest, RiskScoringResponse
from src.modules.risk.queries.score_risk_subject.score_risk_subject_query import ScoreRiskSubjectQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class RiskController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def score_risk(self, request: RiskScoringRequest) -> RiskScoringResponse:
        response: RiskScoringResponse = await run_within_request_deadline(
            self.query_bus.execute(ScoreRiskSubjectQuery(request)), self.deadline_seconds
        )
        return response
