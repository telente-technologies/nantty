defmodule Realtime.Topics.TopicAuthorizerTest do
  use ExUnit.Case, async: false
  alias Realtime.Topics.TopicAuthorizer

  @principal %{account_id: "account-1", session_id: "session-1", roles: []}

  defmodule AllowAll do
    def can_join?(_account_id, _topic), do: true
  end

  defmodule DenyAll do
    def can_join?(_account_id, _topic), do: false
  end

  defmodule RecordingChecker do
    def can_join?(account_id, topic) do
      send(Application.fetch_env!(:realtime, :live_access_test_pid), {:asked, account_id, topic})
      topic == "live:live-9"
    end
  end

  setup do
    previous = Application.get_env(:realtime, :live_access_checker)
    on_exit(fn -> restore(previous) end)
    :ok
  end

  defp restore(nil), do: Application.delete_env(:realtime, :live_access_checker)
  defp restore(value), do: Application.put_env(:realtime, :live_access_checker, value)

  test "allows own user topic and live and battle topics the live service permits" do
    Application.put_env(:realtime, :live_access_checker, AllowAll)
    assert TopicAuthorizer.authorize_subscription(@principal, "user:account-1") == :ok
    assert TopicAuthorizer.authorize_subscription(@principal, "live:live-9") == :ok
    assert TopicAuthorizer.authorize_subscription(@principal, "battle:battle-3") == :ok
  end

  test "denies live and battle topics the live service refuses" do
    Application.put_env(:realtime, :live_access_checker, DenyAll)

    assert TopicAuthorizer.authorize_subscription(@principal, "live:live-9") ==
             {:error, :forbidden}

    assert TopicAuthorizer.authorize_subscription(@principal, "battle:battle-3") ==
             {:error, :forbidden}
  end

  test "asks live with the account id and the full topic" do
    Application.put_env(:realtime, :live_access_test_pid, self())
    Application.put_env(:realtime, :live_access_checker, RecordingChecker)
    assert TopicAuthorizer.authorize_subscription(@principal, "live:live-9") == :ok
    assert_receive {:asked, "account-1", "live:live-9"}

    assert TopicAuthorizer.authorize_subscription(@principal, "battle:b-1") ==
             {:error, :forbidden}

    assert_receive {:asked, "account-1", "battle:b-1"}
  end

  test "denies live topics when the live service is not configured" do
    Application.delete_env(:realtime, :live_access_checker)

    assert TopicAuthorizer.authorize_subscription(@principal, "live:live-9") ==
             {:error, :forbidden}
  end

  test "denies other users, unknown kinds and conversations without membership" do
    Application.put_env(:realtime, :live_access_checker, AllowAll)

    assert TopicAuthorizer.authorize_subscription(@principal, "user:account-2") ==
             {:error, :forbidden}

    assert TopicAuthorizer.authorize_subscription(@principal, "admin:all") == {:error, :forbidden}
    assert TopicAuthorizer.authorize_subscription(@principal, "live:") == {:error, :forbidden}

    assert TopicAuthorizer.authorize_subscription(@principal, "conversation:c-1") ==
             {:error, :forbidden}
  end
end
