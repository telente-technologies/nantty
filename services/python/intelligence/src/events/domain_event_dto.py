import json
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, Field, TypeAdapter

from src.dtos.common_dto import ContractModel
from src.events.event_payload_dto import (
    AdImpressionPayload,
    FollowedPayload,
    GiftSentPayload,
    ProductViewedPayload,
    ReportedPayload,
)
from src.validators.common_field_validator import CountryCode, OpaqueIdentifier


class DomainEnvelopeBase(ContractModel):
    event_id: OpaqueIdentifier
    occurred_at: AwareDatetime
    actor_id: OpaqueIdentifier
    country: CountryCode | None = None


class MessageMetadataPayload(ContractModel):
    recipient_id: OpaqueIdentifier
    conversation_id: OpaqueIdentifier
    contains_link: bool = False
    link_reported: bool = False
    device_id: OpaqueIdentifier | None = None
    ip_hash: OpaqueIdentifier | None = None


class PostCreatedPayload(ContractModel):
    post_id: OpaqueIdentifier
    kind: Literal["post", "clip", "story"] = "post"
    text: str = Field(default="", max_length=5000)
    media_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=20)


class MediaProcessedPayload(ContractModel):
    media_id: OpaqueIdentifier
    purpose: str | None = Field(default=None, max_length=40)
    kind: str | None = Field(default=None, max_length=20)
    image_key: str | None = Field(default=None, max_length=1024)


class BlockCreatedPayload(ContractModel):
    blocked_account_id: OpaqueIdentifier


class LoginPayload(ContractModel):
    device_id: OpaqueIdentifier | None = None
    ip_hash: OpaqueIdentifier | None = None


class ConsentChangePayload(ContractModel):
    consent_type: Literal["analytics", "personalization", "advertising", "marketing"]


class EmptyPayload(ContractModel):
    pass


class ProductViewedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["product.viewed"]
    payload: ProductViewedPayload


class FollowCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["follow.created"]
    payload: FollowedPayload


class PostCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["post.created"]
    payload: PostCreatedPayload


class MediaProcessedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["media.processed"]
    payload: MediaProcessedPayload


class GiftSentDomainEvent(DomainEnvelopeBase):
    event_type: Literal["gift.sent"]
    payload: GiftSentPayload


class MessageSentDomainEvent(DomainEnvelopeBase):
    event_type: Literal["message.sent"]
    payload: MessageMetadataPayload


class ReportCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["report.created"]
    payload: ReportedPayload


class BlockCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["block.created"]
    payload: BlockCreatedPayload


class AdImpressionRecordedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["ad.impressionRecorded"]
    payload: AdImpressionPayload


class LoggedInDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.loggedIn"]
    payload: LoginPayload


class AccountRegisteredDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.registered"]
    payload: EmptyPayload


class ConsentGrantedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["consent.granted"]
    payload: ConsentChangePayload


class ConsentWithdrawnDomainEvent(DomainEnvelopeBase):
    event_type: Literal["consent.withdrawn"]
    payload: ConsentChangePayload


class AccountDeletionRequestedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.deletionRequested"]
    payload: EmptyPayload


class AccountDeletionExecutedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.deletionExecuted"]
    payload: EmptyPayload


type DomainEvent = Annotated[
    ProductViewedDomainEvent
    | FollowCreatedDomainEvent
    | PostCreatedDomainEvent
    | MediaProcessedDomainEvent
    | GiftSentDomainEvent
    | MessageSentDomainEvent
    | ReportCreatedDomainEvent
    | BlockCreatedDomainEvent
    | AdImpressionRecordedDomainEvent
    | LoggedInDomainEvent
    | AccountRegisteredDomainEvent
    | ConsentGrantedDomainEvent
    | ConsentWithdrawnDomainEvent
    | AccountDeletionRequestedDomainEvent
    | AccountDeletionExecutedDomainEvent,
    Field(discriminator="event_type"),
]

domain_event_type_adapter: TypeAdapter[DomainEvent] = TypeAdapter(DomainEvent)


REPORT_REASON_CODES = {
    "fraud": "scam",
    "sexual_content": "nudity",
    "prohibited_items": "counterfeit",
    "self_harm": "violence",
}
REPORT_KNOWN_REASON_CODES = {"spam", "scam", "nudity", "violence", "hate", "counterfeit", "harassment", "other"}
REPORT_CHAT_TARGET_TYPES = {"message", "conversation", "group"}


def normalize_report_created(data: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    target_type = data.get("targetType")
    target_id = data.get("targetId")
    if target_type == "user":
        target_type = "account"
    elif target_type in REPORT_CHAT_TARGET_TYPES:
        target_type, target_id = "account", data.get("reportedUserId") or target_id
    reason = REPORT_REASON_CODES.get(str(data.get("reason")), str(data.get("reason")))
    return {
        "actorId": data.get("reporterId") or body.get("subject"),
        "payload": {
            "targetId": target_id,
            "targetType": target_type,
            "targetAuthorId": data.get("reportedUserId"),
            "reasonCode": reason if reason in REPORT_KNOWN_REASON_CODES else "other",
        },
    }


REKOGNITION_IMAGE_FORMATS = {"jpeg", "jpg", "png"}


def select_rekognition_compatible_image_key(data: dict[str, Any]) -> str | None:
    variants = data.get("variants")
    if isinstance(variants, list):
        for variant in variants:
            if (
                isinstance(variant, dict)
                and str(variant.get("format", "")).lower() in REKOGNITION_IMAGE_FORMATS
                and isinstance(variant.get("key"), str)
            ):
                return str(variant["key"])
    poster_key = data.get("posterKey")
    if isinstance(poster_key, str) and poster_key.lower().rsplit(".", 1)[-1] in REKOGNITION_IMAGE_FORMATS:
        return poster_key
    return None


def normalize_contract_envelope(body: Any) -> Any:
    if not (isinstance(body, dict) and "schemaVersion" in body and isinstance(body.get("data"), dict)):
        return body
    data: dict[str, Any] = body["data"]
    event_type = body.get("type")
    flat: dict[str, Any] = {"eventId": body.get("id"), "eventType": event_type, "occurredAt": body.get("occurredAt")}
    if event_type == "gift.sent":
        sender = data.get("sender")
        sender_id = (sender.get("userId") or sender.get("id")) if isinstance(sender, dict) else None
        flat["actorId"] = sender_id or body.get("subject")
        flat["payload"] = {
            "giftId": data.get("giftTransactionId"),
            "creatorId": data.get("receiverUserId"),
            "coinAmount": data.get("totalCoins"),
            "hostContentId": data.get("liveId"),
        }
        return flat
    if event_type == "post.created":
        flat["actorId"] = data.get("authorId") or body.get("subject")
        flat["payload"] = {
            "postId": data.get("postId"),
            "kind": data.get("kind", "post"),
            "text": data.get("text", ""),
            "mediaIds": data.get("mediaIds", []),
        }
        return flat
    if event_type == "media.processed":
        flat["actorId"] = data.get("ownerId") or body.get("subject")
        flat["payload"] = {
            "mediaId": data.get("mediaId"),
            "purpose": data.get("purpose"),
            "kind": data.get("kind"),
            "imageKey": select_rekognition_compatible_image_key(data),
        }
        return flat
    if event_type == "report.created":
        return {**flat, **normalize_report_created(data, body)}
    if event_type == "message.sent":
        recipients = data.get("recipientIds") or []
        flat["actorId"] = data.get("senderId") or body.get("subject")
        flat["payload"] = {
            "recipientId": recipients[0] if recipients else None,
            "conversationId": data.get("conversationId"),
        }
        return flat
    if event_type == "follow.created":
        flat["actorId"] = data.get("followerId") or body.get("subject")
        flat["payload"] = {"targetAccountId": data.get("followeeId"), "targetKind": "user"}
        return flat
    if event_type == "block.created":
        flat["actorId"] = data.get("blockerId") or body.get("subject")
        flat["payload"] = {"blockedAccountId": data.get("blockedId")}
        return flat
    flat["actorId"] = data.get("accountId") or body.get("subject")
    flat["payload"] = {"consentType": data["consentType"]} if "consentType" in data else {}
    return flat


def unwrap_queue_message_body(parsed_body: Any) -> Any:
    if isinstance(parsed_body, dict) and isinstance(parsed_body.get("Message"), str) and "eventType" not in parsed_body:
        parsed_body = json.loads(parsed_body["Message"])
    return normalize_contract_envelope(parsed_body)
