from dataclasses import dataclass
from datetime import UTC, datetime

SECONDS_PER_DAY = 86_400
AFFINITY_HALF_LIFE_SECONDS = 14 * SECONDS_PER_DAY
TRENDING_SHORT_HALF_LIFE_SECONDS = 6 * 3600
TRENDING_LONG_HALF_LIFE_SECONDS = 7 * SECONDS_PER_DAY
CLIP_TOPIC_POPULARITY_HALF_LIFE_SECONDS = 2 * SECONDS_PER_DAY
SEEN_ITEMS_RETENTION_COUNT = 1000
SEEN_ITEMS_TTL_SECONDS = 14 * SECONDS_PER_DAY
ITEM_STATISTICS_TTL_SECONDS = 90 * SECONDS_PER_DAY
DAILY_COUNTER_TTL_SECONDS = 3 * SECONDS_PER_DAY
TRENDING_ACTOR_DEDUPLICATION_TTL_SECONDS = 3600
EXPERIMENT_COUNTER_TTL_SECONDS = 120 * SECONDS_PER_DAY
TOPIC_AFFINITY_KIND = "topic"
ACCOUNT_AFFINITY_KIND = "account"
VALUE_FLOW_HALF_LIFE_SECONDS = 7 * SECONDS_PER_DAY
BEHAVIOUR_RETENTION_DAYS = 3
BEHAVIOUR_COUNTER_TTL_SECONDS = BEHAVIOUR_RETENTION_DAYS * SECONDS_PER_DAY
ACCOUNT_PROFILE_TTL_SECONDS = 90 * SECONDS_PER_DAY
PERSONALIZATION_OPT_OUT_FIELD = "personalization_opt_out"
ACCOUNT_DELETED_FIELD = "account_deleted"


def format_utc_day_bucket(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y%m%d")


def format_utc_hour_bucket(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y%m%d%H")


@dataclass(frozen=True, slots=True)
class OnlineFeatureKeyspace:
    prefix: str

    def nonce_key(self, nonce: str) -> str:
        return f"{self.prefix}:nonce:{nonce}"

    def event_deduplication_key(self, event_id: str) -> str:
        return f"{self.prefix}:event:{event_id}"

    def internal_claim_key(self, namespace: str, claim_id: str) -> str:
        return f"{self.prefix}:claim:{namespace}:{claim_id}"

    def affinity_base_key(self, affinity_kind: str, user_id: str) -> str:
        return f"{self.prefix}:aff:{affinity_kind}:{user_id}"

    def comment_signal_key(self, comment_id: str) -> str:
        return f"{self.prefix}:commentsig:{comment_id}"

    def item_statistics_key(self, item_id: str) -> str:
        return f"{self.prefix}:item:{item_id}"

    def recently_seen_items_key(self, user_id: str) -> str:
        return f"{self.prefix}:seen:{user_id}"

    def ad_statistics_key(self, ad_id: str) -> str:
        return f"{self.prefix}:ad:{ad_id}"

    def ad_frequency_key(self, day_bucket: str, user_id: str) -> str:
        return f"{self.prefix}:adfreq:{day_bucket}:{user_id}"

    def campaign_spend_key(self, day_bucket: str, campaign_id: str) -> str:
        return f"{self.prefix}:spend:{day_bucket}:{campaign_id}"

    def trending_base_key(self, item_kind: str, scope: str, horizon: str) -> str:
        return f"{self.prefix}:trend:{item_kind}:{scope}:{horizon}"

    def trending_distinct_actors_key(self, item_kind: str, scope: str, item_id: str, day_bucket: str) -> str:
        return f"{self.prefix}:trendactors:{item_kind}:{scope}:{item_id}:{day_bucket}"

    def trending_actor_claim_key(self, item_kind: str, item_id: str, actor_id: str, hour_bucket: str) -> str:
        return f"{self.prefix}:trendclaim:{item_kind}:{item_id}:{actor_id}:{hour_bucket}"

    def trending_cluster_claim_key(self, item_kind: str, item_id: str, cluster_key: str, hour_bucket: str) -> str:
        return f"{self.prefix}:trendcluster:{item_kind}:{item_id}:{cluster_key}:{hour_bucket}"

    def trending_integrity_key(self, item_kind: str, item_id: str, day_bucket: str) -> str:
        return f"{self.prefix}:trendintegrity:{item_kind}:{item_id}:{day_bucket}"

    def actor_velocity_key(self, actor_id: str, hour_bucket: str) -> str:
        return f"{self.prefix}:actorvelocity:{actor_id}:{hour_bucket}"

    def clip_topic_popularity_base_key(self, topic: str) -> str:
        return f"{self.prefix}:pop:clip:topic:{topic}"

    def value_flow_base_key(self, flow_direction: str, account_id: str) -> str:
        return f"{self.prefix}:flow:{flow_direction}:{account_id}"

    def audio_landmark_key(self, landmark_hash: int) -> str:
        return f"{self.prefix}:audio:landmark:{landmark_hash}"

    def audio_excerpt_claim_key(self, sound_id: str, excerpt_start_second: int) -> str:
        return f"{self.prefix}:audio:excerpt:{sound_id}:{excerpt_start_second}"

    def audio_sound_metadata_key(self, sound_id: str) -> str:
        return f"{self.prefix}:audio:sound:{sound_id}"

    def experiment_counter_key(self, experiment_key: str, variant_name: str) -> str:
        return f"{self.prefix}:exp:{experiment_key}:{variant_name}"

    def media_post_link_key(self, media_id: str) -> str:
        return f"{self.prefix}:media_post:{media_id}"

    def consent_key(self, user_id: str) -> str:
        return f"{self.prefix}:consent:{user_id}"

    def pending_dataset_erasure_key(self) -> str:
        return f"{self.prefix}:erasure:pending"

    def behaviour_counter_key(self, account_id: str, day_bucket: str) -> str:
        return f"{self.prefix}:behaviour:{day_bucket}:{account_id}"

    def behaviour_distinct_key(self, set_name: str, account_id: str, day_bucket: str) -> str:
        return f"{self.prefix}:behaviourset:{set_name}:{day_bucket}:{account_id}"

    def account_profile_key(self, account_id: str) -> str:
        return f"{self.prefix}:acctprofile:{account_id}"

    def experiment_distinct_users_key(self, experiment_key: str, variant_name: str) -> str:
        return f"{self.prefix}:expusers:{experiment_key}:{variant_name}"


def append_generation_suffix(base_key: str, generation_index: int) -> str:
    return f"{base_key}:g{generation_index}"
