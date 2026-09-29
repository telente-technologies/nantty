from src.interfaces.cqrs_interface import QueryHandler
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringResponse
from src.modules.risk.queries.score_risk_subject.score_risk_subject_query import ScoreRiskSubjectQuery
from src.modules.risk.services.risk_scoring_service import RiskScoringService


class ScoreRiskSubjectHandler(QueryHandler[ScoreRiskSubjectQuery, RiskScoringResponse]):
    query_type = "risk.scoreRiskSubject"

    def __init__(self, risk_scoring_service: RiskScoringService) -> None:
        self.risk_scoring_service = risk_scoring_service

    async def execute(self, query: ScoreRiskSubjectQuery) -> RiskScoringResponse:
        return await self.risk_scoring_service.score_risk(query.request)
