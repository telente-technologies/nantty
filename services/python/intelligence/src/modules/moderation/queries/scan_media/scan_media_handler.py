import asyncio

from fastapi import HTTPException

from src.interfaces.cqrs_interface import QueryHandler
from src.modules.child_safety.dtos.child_safety_dto import MediaScanResponse
from src.modules.child_safety.services.media_child_safety_scan_service import (
    MediaChildSafetyScanService,
    MediaScanRejectedError,
)
from src.modules.moderation.queries.scan_media.scan_media_query import ScanMediaQuery


class ScanMediaHandler(QueryHandler[ScanMediaQuery, MediaScanResponse]):
    query_type = "moderation.scanMedia"

    def __init__(self, service: MediaChildSafetyScanService) -> None:
        self.service = service

    async def execute(self, query: ScanMediaQuery) -> MediaScanResponse:
        try:
            return await asyncio.to_thread(self.service.scan_media, query.request)
        except MediaScanRejectedError as error:
            raise HTTPException(status_code=422, detail="frames must be base64 encoded images") from error
