import json
from typing import Any

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


SHARE_CHANNELS = {"in_app", "external", "message", "story"}
SAVED_TARGET_TYPES = {"post": "post", "video": "post", "clip": "clip", "product": "product"}


def item_topics(data: dict[str, Any]) -> dict[str, Any]:
    return {key: data[key] for key in ("topics", "hashtags") if isinstance(data.get(key), list)}


def normalize_comment_created(data: dict[str, Any], flat: dict[str, Any]) -> dict[str, Any]:
    post_author = data.get("postAuthorId") or (data.get("recipientUserId") if data.get("target") == "post" else None)
    if post_author is not None:
        flat["eventId"] = f"comment.created:{data.get('commentId')}"
    flat["actorId"] = data.get("authorId")
    flat["payload"] = {"postId": data.get("postId"), "authorId": post_author, **item_topics(data)}
    return flat


def normalize_social_engagement(event_type: Any, data: dict[str, Any], flat: dict[str, Any]) -> dict[str, Any] | None:
    if event_type == "post.liked":
        flat["actorId"] = data.get("likedBy")
        flat["payload"] = {"postId": data.get("postId"), "authorId": data.get("authorId"), **item_topics(data)}
    elif event_type == "post.shared":
        channel = data.get("channel")
        flat["actorId"] = data.get("sharedBy")
        flat["payload"] = {
            "postId": data.get("postId"),
            "authorId": data.get("authorId"),
            "channel": channel if channel in SHARE_CHANNELS else ("external" if channel else "in_app"),
            **item_topics(data),
        }
    elif event_type == "comment.created":
        return normalize_comment_created(data, flat)
    elif event_type == "content.saved":
        flat["actorId"] = data.get("accountId") or data.get("userId")
        flat["payload"] = {
            "targetId": data.get("targetId"),
            "targetType": SAVED_TARGET_TYPES.get(str(data.get("targetType")), data.get("targetType")),
            "authorId": data.get("authorId"),
            **item_topics(data),
        }
    elif event_type == "post.viewed":
        flat["actorId"] = data.get("viewerId")
        flat["payload"] = {
            "postId": data.get("postId"),
            "authorId": data.get("authorId"),
            "dwellMs": data.get("dwellMs", 0),
            "position": data.get("position"),
            "isProductPost": data.get("isProductPost", False),
            **item_topics(data),
        }
    elif event_type == "clip.watched":
        flat["actorId"] = data.get("viewerId")
        flat["payload"] = {
            "clipId": data.get("clipId"),
            "creatorId": data.get("creatorId"),
            "watchFraction": data.get("watchFraction"),
            "loopCount": data.get("loopCount", 0),
            "durationMs": data.get("durationMs"),
            **item_topics(data),
        }
    else:
        return None
    return flat


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
    social = normalize_social_engagement(event_type, data, flat)
    if social is not None:
        return social
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
