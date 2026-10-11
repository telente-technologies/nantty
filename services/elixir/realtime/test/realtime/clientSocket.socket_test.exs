defmodule RealtimeWeb.ClientSocketTest do
  use ExUnit.Case, async: false
  alias Phoenix.PubSub
  alias Realtime.Auth.{JwksKeyCache, RevocationList}
  alias Realtime.Connections.ConnectionLimiter
  alias RealtimeWeb.ClientSocket

  defmodule Members do
    def member?(_account_id, conversation_id), do: conversation_id != "c-other"

    def member_summary(account_id, _conversation_id),
      do: %{"id" => account_id, "name" => "Ada", "avatarUrl" => "https://a/x.png"}
  end

  setup do
    private_jwk = JOSE.JWK.generate_key({:okp, :Ed25519})
    {_, public_map} = private_jwk |> JOSE.JWK.to_public() |> JOSE.JWK.to_map()

    JwksKeyCache.put_keys_for_tests([
      Map.merge(public_map, %{"kid" => "sock-kid", "alg" => "EdDSA"})
    ])

    previous = Application.get_env(:realtime, :conversation_membership_checker)
    Application.put_env(:realtime, :conversation_membership_checker, Members)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:realtime, :conversation_membership_checker, previous),
        else: Application.delete_env(:realtime, :conversation_membership_checker)

      Application.delete_env(:realtime, :client_frames_per_minute)
      Application.delete_env(:realtime, :max_connections_per_user)
    end)

    %{jwk: private_jwk}
  end

  defp token(jwk, account_id, session_id) do
    claims = %{
      "iss" => "https://auth.zudomart.test",
      "aud" => ["zudomart-realtime"],
      "scope" => "realtime",
      "sub" => account_id,
      "sid" => session_id,
      "iat" => System.os_time(:second),
      "exp" => System.os_time(:second) + 300
    }

    {_, compact} =
      JOSE.JWT.sign(jwk, %{"alg" => "EdDSA", "kid" => "sock-kid"}, claims) |> JOSE.JWS.compact()

    compact
  end

  defp new_socket do
    {:ok, state} = ClientSocket.connect(%{})
    state
  end

  defp frame(state, payload), do: ClientSocket.handle_in({Jason.encode!(payload), []}, state)

  defp authenticated(jwk, account_id, session_id \\ "sock-#{System.unique_integer([:positive])}") do
    {:reply, :ok, {:text, reply}, state} =
      frame(new_socket(), %{type: "auth", accessToken: token(jwk, account_id, session_id)})

    assert Jason.decode!(reply) == %{"type" => "auth.ok"}
    state
  end

  test "closes with 4429 once a client sends too many frames in a minute" do
    Application.put_env(:realtime, :client_frames_per_minute, 3)
    state = new_socket()
    {:reply, :ok, _, state} = frame(state, %{type: "ping"})
    {:reply, :ok, _, state} = frame(state, %{type: "ping"})
    {:reply, :ok, _, state} = frame(state, %{type: "ping"})

    assert {:stop, :normal, 4429, [{:text, body}], _state} = frame(state, %{type: "ping"})
    assert Jason.decode!(body)["code"] == "TOO_MANY_MESSAGES"
  end

  test "closes with 4401 when the token was revoked", %{jwk: jwk} do
    RevocationList.revoke_session("sid-revoked")

    assert {:stop, :normal, 4401, [{:text, body}], _} =
             frame(new_socket(), %{type: "auth", accessToken: token(jwk, "acc-r", "sid-revoked")})

    assert Jason.decode!(body) == %{"type" => "auth.failed"}
  end

  test "typing frames carry the typist's name and avatar", %{jwk: jwk} do
    PubSub.subscribe(Realtime.PubSub, "conversation:c-1")
    test_pid = self()

    Task.async(fn ->
      state = authenticated(jwk, "acc-typist")
      {:reply, :ok, _, state} = frame(state, %{type: "subscribe", topic: "conversation:c-1"})
      send(test_pid, frame(state, %{type: "typing", conversationId: "c-1", isTyping: true}))
    end)
    |> Task.await()

    assert_receive {:ok, _state}

    assert_receive {:realtime_event, "conversation:c-1",
                    %{
                      type: "typing",
                      conversationId: "c-1",
                      isTyping: true,
                      user: %{
                        "id" => "acc-typist",
                        "name" => "Ada",
                        "avatarUrl" => "https://a/x.png"
                      }
                    }}
  end

  test "refuses conversations the account is not a member of", %{jwk: jwk} do
    state = authenticated(jwk, "acc-outsider")

    {:reply, :ok, {:text, reply}, _} =
      frame(state, %{type: "subscribe", topic: "conversation:c-other"})

    assert %{"code" => "FORBIDDEN"} = Jason.decode!(reply)
  end

  test "member fan-out is skipped when the socket already follows that conversation", %{jwk: jwk} do
    state = authenticated(jwk, "acc-fan")
    payload = %{"type" => "message.created", "conversationId" => "c-1"}

    assert {:push, {:text, _}, _} =
             ClientSocket.handle_info({:conversation_fanout, "c-1", payload}, state)

    {:reply, :ok, _, state} = frame(state, %{type: "subscribe", topic: "conversation:c-1"})
    assert {:ok, _} = ClientSocket.handle_info({:conversation_fanout, "c-1", payload}, state)
  end

  test "enforcement closes the matching session or every session", %{jwk: jwk} do
    state = authenticated(jwk, "acc-enf", "sid-a")

    assert {:ok, _} =
             ClientSocket.handle_info(
               {:disconnect, {:session, "sid-b"}, "session.revoked"},
               state
             )

    assert {:stop, :normal, 4403, [{:text, body}], _} =
             ClientSocket.handle_info(
               {:disconnect, {:session, "sid-a"}, "session.revoked"},
               state
             )

    assert Jason.decode!(body) == %{"type" => "session.ended", "reason" => "session.revoked"}

    assert {:stop, :normal, 4403, _, _} =
             ClientSocket.handle_info({:disconnect, :all, "account.banned"}, state)
  end

  test "a new connection beyond the per-user cap replaces the oldest" do
    Application.put_env(:realtime, :max_connections_per_user, 2)
    test_pid = self()

    holders =
      for index <- 1..2 do
        pid =
          spawn(fn ->
            ConnectionLimiter.register("acc-cap")
            send(test_pid, {:registered, index})

            receive do
              :connection_replaced -> send(test_pid, {:replaced, index})
            end
          end)

        assert_receive {:registered, ^index}
        pid
      end

    ConnectionLimiter.register("acc-cap")
    assert_receive {:replaced, 1}
    refute_receive {:replaced, 2}
    Enum.each(holders, &Process.exit(&1, :kill))

    assert {:stop, :normal, 4409, _, _} =
             ClientSocket.handle_info(:connection_replaced, new_socket())
  end
end
