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
    flat["actorId"] = data.get("accountId") or body.get("subject")
    flat["payload"] = {"consentType": data["consentType"]} if "consentType" in data else {}
    return flat


def unwrap_queue_message_body(parsed_body: Any) -> Any:
    if isinstance(parsed_body, dict) and isinstance(parsed_body.get("Message"), str) and "eventType" not in parsed_body:
        parsed_body = json.loads(parsed_body["Message"])
    return normalize_contract_envelope(parsed_body)
