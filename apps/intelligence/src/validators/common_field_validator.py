from typing import Annotated

from pydantic import Field, StringConstraints

OpaqueIdentifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_\-:.]{1,128}$", min_length=1, max_length=128)]


TopicSlug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_\-]{1,64}$")]


CountryCode = Annotated[str, StringConstraints(pattern=r"^[A-Z]{2}$")]


RegionCode = Annotated[str, StringConstraints(pattern=r"^[A-Z0-9\-]{1,12}$")]


CurrencyCode = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]


UnitInterval = Annotated[float, Field(ge=0.0, le=1.0)]


NonNegativeCount = Annotated[int, Field(ge=0, le=10**12)]


AgeBracket = Annotated[str, StringConstraints(pattern=r"^(13-17|18-24|25-34|35-44|45-54|55-64|65\+)$")]


MAXIMUM_TOPICS_PER_ITEM = 20


MAXIMUM_RANKING_CANDIDATES = 500


MAXIMUM_ID_LIST_LENGTH = 5000
