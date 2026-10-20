import asyncio
import json
import re
from typing import Any, Protocol

TRANSCRIPTION_POLL_SECONDS = 3.0
TRANSCRIPTION_TIMEOUT_SECONDS = 180.0
SAFE_JOB_NAME = re.compile(r"[^0-9A-Za-z._-]")


class TranscribeClient(Protocol):
    def start_transcription_job(self, **kwargs: Any) -> dict[str, Any]:
        pass

    def get_transcription_job(self, **kwargs: Any) -> dict[str, Any]:
        pass


class ObjectReader(Protocol):
    def get_object(self, **kwargs: Any) -> dict[str, Any]:
        pass


class SegmentTranscriber(Protocol):
    async def transcribe_segment(self, segment_id: str, bucket: str, key: str) -> str:
        pass


class DisabledSegmentTranscriber:
    async def transcribe_segment(self, _segment_id: str, _bucket: str, _key: str) -> str:
        return ""


class TranscriptionFailedError(RuntimeError):
    pass


def is_conflict_error(error: Exception) -> bool:
    response = getattr(error, "response", None)
    code = response.get("Error", {}).get("Code") if isinstance(response, dict) else None
    return code == "ConflictException" or type(error).__name__ == "ConflictException"


class TranscribeBatchTranscriber:
    def __init__(
        self,
        transcribe: TranscribeClient,
        objects: ObjectReader,
        output_bucket: str,
        output_prefix: str = "live-safety/transcripts/",
        language_code: str = "en-US",
        poll_seconds: float = TRANSCRIPTION_POLL_SECONDS,
        timeout_seconds: float = TRANSCRIPTION_TIMEOUT_SECONDS,
    ) -> None:
        self.transcribe = transcribe
        self.objects = objects
        self.output_bucket = output_bucket
        self.output_prefix = output_prefix
        self.language_code = language_code
        self.poll_seconds = poll_seconds
        self.timeout_seconds = timeout_seconds

    async def transcribe_segment(self, segment_id: str, bucket: str, key: str) -> str:
        job_name = SAFE_JOB_NAME.sub("-", f"live-safety-{segment_id}")[:200]
        output_key = f"{self.output_prefix}{job_name}.json"
        media_format = (
            "mp4"
            if key.endswith((".m4a", ".mp4"))
            else "mp3"
            if key.endswith(".mp3")
            else "wav"
            if key.endswith(".wav")
            else "mp4"
        )
        try:
            await self.start_transcription_job_once(job_name, bucket, key, media_format, output_key)
        except Exception as start_error:
            if not is_conflict_error(start_error):
                raise
        waited = 0.0
        while waited < self.timeout_seconds:
            job = (await asyncio.to_thread(self.transcribe.get_transcription_job, TranscriptionJobName=job_name))[
                "TranscriptionJob"
            ]
            status = job.get("TranscriptionJobStatus")
            if status == "COMPLETED":
                return await self.read_transcript(output_key)
            if status == "FAILED":
                raise TranscriptionFailedError(str(job.get("FailureReason", "transcription failed")))
            await asyncio.sleep(self.poll_seconds)
            waited += self.poll_seconds
        raise TranscriptionFailedError("transcription timed out")

    async def start_transcription_job_once(
        self, job_name: str, bucket: str, key: str, media_format: str, output_key: str
    ) -> None:
        await asyncio.to_thread(
            self.transcribe.start_transcription_job,
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": f"s3://{bucket}/{key}"},
            MediaFormat=media_format,
            LanguageCode=self.language_code,
            OutputBucketName=self.output_bucket,
            OutputKey=output_key,
        )

    async def read_transcript(self, output_key: str) -> str:
        response = await asyncio.to_thread(self.objects.get_object, Bucket=self.output_bucket, Key=output_key)
        document = json.loads(await asyncio.to_thread(response["Body"].read))
        transcripts = document.get("results", {}).get("transcripts", [])
        return " ".join(str(item.get("transcript", "")) for item in transcripts).strip()
