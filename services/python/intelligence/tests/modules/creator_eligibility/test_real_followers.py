from typing import Any

from tests.conftest import SignedIntelligenceClient


def follower(index: int, **overrides: Any) -> dict[str, Any]:
    return {
        "followerId": f"f{index}",
        "accountAgeDays": 400,
        "hasProfilePhoto": True,
        "postCount": 20,
        "activeDaysLast30": 15,
        "followedAccountCount": 120,
        "deviceClusterSize": 1,
        "signupBurstSize": 1,
        "phoneVerified": True,
        **overrides,
    }


async def estimate(client: SignedIntelligenceClient, followers: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    response = await client.post(
        "/v1/creators/real-followers", {"creatorId": "creator_1", "followers": followers, **extra}
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_organic_followers_are_mostly_real(signed_client: SignedIntelligenceClient) -> None:
    body = await estimate(signed_client, [follower(index) for index in range(200)])
    assert body["estimatedRealRatio"] > 0.85
    assert body["suspiciousFollowers"] == 0
    assert body["realFollowersLowerBound"] <= body["estimatedRealFollowers"] <= 200


async def test_bot_farm_is_discounted_and_explained(signed_client: SignedIntelligenceClient) -> None:
    bots = [
        follower(
            index,
            accountAgeDays=1,
            hasProfilePhoto=False,
            postCount=0,
            activeDaysLast30=0,
            followedAccountCount=5000,
            deviceClusterSize=30,
            signupBurstSize=100,
            phoneVerified=False,
        )
        for index in range(100)
    ]
    body = await estimate(signed_client, [follower(index) for index in range(100)] + bots)
    assert body["suspiciousFollowers"] == 100
    assert 0.4 < body["estimatedRealRatio"] < 0.55
    assert "shared_device_cluster" in body["topReasons"]


async def test_sample_is_scaled_to_total_follower_count(signed_client: SignedIntelligenceClient) -> None:
    body = await estimate(signed_client, [follower(index) for index in range(100)], totalFollowerCount=10_000)
    assert body["estimatedRealFollowers"] > 8500
    assert body["realFollowersLowerBound"] < body["estimatedRealFollowers"]


async def test_empty_sample_estimates_zero(signed_client: SignedIntelligenceClient) -> None:
    body = await estimate(signed_client, [])
    assert body["estimatedRealFollowers"] == 0
    assert body["realFollowersLowerBound"] == 0
