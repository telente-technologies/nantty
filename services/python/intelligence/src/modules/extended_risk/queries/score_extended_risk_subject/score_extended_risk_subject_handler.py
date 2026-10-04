from src.interfaces.cqrs_interface import QueryHandler
from src.modules.extended_risk.dtos.extended_risk_dto import ExtendedRiskResponse
from src.modules.extended_risk.queries.score_extended_risk_subject.score_extended_risk_subject_query import (
    ScoreExtendedRiskSubjectQuery,
)
from src.modules.extended_risk.services.extended_risk_scoring_service import ExtendedRiskScoringService


class ScoreExtendedRiskSubjectHandler(QueryHandler[ScoreExtendedRiskSubjectQuery, ExtendedRiskResponse]):
    query_type = "extendedRisk.scoreExtendedRiskSubject"

    def __init__(self, service: ExtendedRiskScoringService) -> None:
        self.service = service

    async def execute(self, query: ScoreExtendedRiskSubjectQuery) -> ExtendedRiskResponse:
        return await self.service.score_extended_risk_subject(query.request)
