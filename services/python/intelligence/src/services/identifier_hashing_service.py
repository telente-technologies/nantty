import hashlib
import hmac
import re
import unicodedata

HASHED_USER_PREFIX = "u_"
HASHED_QUERY_PREFIX = "q_"
HASH_HEX_LENGTH = 40
DERIVATION_LABEL = b"zudomart:intelligence:user-id-hash"
HASHED_USER_PATTERN = re.compile(rf"^{HASHED_USER_PREFIX}[0-9a-f]{{{HASH_HEX_LENGTH}}}$")


def derive_identifier_hash_key(id_hash_secret: str, shared_secret: str) -> bytes:
    if id_hash_secret:
        return id_hash_secret.encode("utf-8")
    return hmac.new(shared_secret.encode("utf-8"), DERIVATION_LABEL, hashlib.sha256).digest()


def is_hashed_user_id(value: str) -> bool:
    return HASHED_USER_PATTERN.fullmatch(value) is not None


class OpaqueIdentifierHasher:
    def __init__(self, key: bytes) -> None:
        self.key = key

    def digest(self, message: str) -> str:
        return hmac.new(self.key, message.encode("utf-8"), hashlib.sha256).hexdigest()[:HASH_HEX_LENGTH]

    def hash_user_id(self, user_id: str) -> str:
        if is_hashed_user_id(user_id):
            return user_id
        return HASHED_USER_PREFIX + self.digest(f"user:{user_id}")

    def hash_optional_user_id(self, user_id: str | None) -> str | None:
        return None if user_id is None else self.hash_user_id(user_id)

    def hash_search_query(self, query_text: str) -> str:
        normalized = " ".join(unicodedata.normalize("NFKC", query_text).strip().lower().split())
        return HASHED_QUERY_PREFIX + self.digest(f"query:{normalized}")
