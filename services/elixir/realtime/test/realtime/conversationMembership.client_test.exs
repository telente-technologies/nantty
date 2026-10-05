defmodule Realtime.Topics.ConversationMembershipClientTest do
  use ExUnit.Case, async: false
  alias Realtime.Topics.{ConversationMembershipClient, TopicAuthorizer}

  defmodule FakeSocial do
    import Plug.Conn

    def init(options), do: options

    def call(conn, _options) do
      test_pid = Application.fetch_env!(:realtime, :fake_social_test_pid)

      send(
        test_pid,
        {:social_called, conn.request_path, get_req_header(conn, "x-internal-token")}
      )

      case conn.path_info do
        ["api", "v1", "internal", "conversations", "c-member", "members", account_id] ->
          user = %{
            "name" => "Ada",
            "avatarUrl" => "https://a/x.png",
            "email" => "hidden",
            "id" => "x"
          }

          respond(conn, 200, %{"member" => true, "user" => Map.put(user, "username", account_id)})

        ["api", "v1", "internal", "conversations", "c-outsider", "members", _] ->
          respond(conn, 200, %{"member" => false})

        ["api", "v1", "internal", "conversations", "c-missing", "members", _] ->
          respond(conn, 404, %{"message" => "Not found", "code" => "NOT_FOUND"})

        _ ->
          respond(conn, 500, %{"message" => "boom", "code" => "INTERNAL"})
      end
    end

    defp respond(conn, status, body) do
      conn |> put_resp_content_type("application/json") |> send_resp(status, Jason.encode!(body))
    end
  end

  setup do
    {:ok, server} =
      Bandit.start_link(plug: FakeSocial, port: 0, ip: {127, 0, 0, 1}, startup_log: false)

    {:ok, {_ip, port}} = ThousandIsland.listener_info(server)
    previous = Application.get_env(:realtime, :social_internal)
    Application.put_env(:realtime, :fake_social_test_pid, self())

    Application.put_env(:realtime, :social_internal,
      url: "http://127.0.0.1:#{port}/",
      token: "internal-token"
    )

    :ets.delete_all_objects(ConversationMembershipClient.table())

    on_exit(fn ->
      Application.put_env(:realtime, :social_internal, previous)
      Application.delete_env(:realtime, :fake_social_test_pid)
    end)

    :ok
  end

  test "asks social with the internal token and caches a member with their summary" do
    assert ConversationMembershipClient.member?("a-1", "c-member")

    assert_receive {:social_called, "/api/v1/internal/conversations/c-member/members/a-1",
                    ["internal-token"]}

    assert ConversationMembershipClient.member_summary("a-1", "c-member") == %{
             "id" => "a-1",
             "name" => "Ada",
             "username" => "a-1",
             "avatarUrl" => "https://a/x.png"
           }

    refute_receive {:social_called, _, _}
  end

  test "treats explicit non-members and missing conversations as forbidden" do
    refute ConversationMembershipClient.member?("a-1", "c-outsider")
    refute ConversationMembershipClient.member?("a-1", "c-missing")
    refute ConversationMembershipClient.member?("a-1", "c-outsider")
    assert_receive {:social_called, "/api/v1/internal/conversations/c-outsider/members/a-1", _}
    assert_receive {:social_called, "/api/v1/internal/conversations/c-missing/members/a-1", _}
    refute_receive {:social_called, _, _}
  end

  test "denies without caching when social fails, so the next check asks again" do
    refute ConversationMembershipClient.member?("a-1", "c-broken")
    refute ConversationMembershipClient.member?("a-1", "c-broken")
    assert_receive {:social_called, _, _}
    assert_receive {:social_called, _, _}
  end

  test "forgetting a membership makes the next check ask social again" do
    assert ConversationMembershipClient.member?("a-2", "c-member")
    TopicAuthorizer.forget_conversation_membership("a-2", "c-member")
    assert ConversationMembershipClient.member?("a-2", "c-member")
    assert_receive {:social_called, _, _}
    assert_receive {:social_called, _, _}
  end

  test "rejects malformed identifiers without calling social" do
    refute ConversationMembershipClient.member?("a-1", "../admin")
    refute ConversationMembershipClient.member?("a-1", "")
    refute_receive {:social_called, _, _}
  end

  test "denies conversations when social is not configured" do
    Application.put_env(:realtime, :social_internal, url: "", token: "")
    refute ConversationMembershipClient.member?("a-1", "c-member")
    refute_receive {:social_called, _, _}
  end

  test "is the default checker behind conversation subscriptions" do
    principal = %{account_id: "a-3", session_id: "s", roles: []}
    assert TopicAuthorizer.authorize_subscription(principal, "conversation:c-member") == :ok

    assert TopicAuthorizer.authorize_subscription(principal, "conversation:c-outsider") ==
             {:error, :forbidden}

    assert %{"id" => "a-3", "name" => "Ada"} =
             TopicAuthorizer.conversation_member_summary(principal, "c-member")
  end
end
