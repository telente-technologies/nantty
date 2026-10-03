defmodule Realtime.Topics.TopicAuthorizerTest do
  use ExUnit.Case, async: true
  alias Realtime.Topics.TopicAuthorizer

  @principal %{account_id: "account-1", session_id: "session-1", roles: []}

  test "allows own user topic and public live and battle topics" do
    assert TopicAuthorizer.authorize_subscription(@principal, "user:account-1") == :ok
    assert TopicAuthorizer.authorize_subscription(@principal, "live:live-9") == :ok
    assert TopicAuthorizer.authorize_subscription(@principal, "battle:battle-3") == :ok
  end

  test "denies other users, unknown kinds and conversations without membership" do
    assert TopicAuthorizer.authorize_subscription(@principal, "user:account-2") ==
             {:error, :forbidden}

    assert TopicAuthorizer.authorize_subscription(@principal, "admin:all") == {:error, :forbidden}
    assert TopicAuthorizer.authorize_subscription(@principal, "live:") == {:error, :forbidden}

    assert TopicAuthorizer.authorize_subscription(@principal, "conversation:c-1") ==
             {:error, :forbidden}
  end
end
