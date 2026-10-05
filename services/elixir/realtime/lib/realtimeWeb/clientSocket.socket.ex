defmodule RealtimeWeb.ClientSocket do
  @behaviour Phoenix.Socket.Transport

  alias Phoenix.PubSub
  alias Realtime.Auth.AccessTokenVerifier
  alias Realtime.Presence
  alias Realtime.Topics.SubscriptionGuard
  alias Realtime.Topics.TopicAuthorizer

  @authentication_deadline_ms 10_000
  @maximum_subscriptions 50

  @impl true
  def child_spec(_options), do: :ignore

  @impl true
  def connect(_transport_info), do: {:ok, %{principal: nil, topics: MapSet.new()}}

  @impl true
  def init(state) do
    Process.send_after(self(), :authentication_deadline, @authentication_deadline_ms)
    schedule_subscription_recheck()
    {:ok, state}
  end

  @impl true
  def handle_in({text, _options}, state) do
    case Jason.decode(text) do
      {:ok, %{"type" => type} = frame} -> handle_client_frame(type, frame, state)
      _ -> reply(%{type: "error", code: "INVALID_FRAME"}, state)
    end
  end

  @impl true
  def handle_info(:recheck_subscriptions, %{principal: nil} = state) do
    schedule_subscription_recheck()
    {:ok, state}
  end

  def handle_info(:recheck_subscriptions, state) do
    schedule_subscription_recheck()
    revoke(state, MapSet.to_list(state.topics))
  end

  def handle_info(
        {:membership_changed, topic, account_id},
        %{principal: %{account_id: account_id}} = state
      ),
      do: revoke(state, [topic])

  def handle_info({:membership_changed, _topic, _account_id}, state), do: {:ok, state}

  def handle_info({:realtime_event, _topic, payload}, state),
    do: {:push, {:text, Jason.encode!(payload)}, state}

  def handle_info(%Phoenix.Socket.Broadcast{payload: payload}, state),
    do: {:push, {:text, Jason.encode!(payload)}, state}

  def handle_info(:authentication_deadline, %{principal: nil} = state),
    do: {:stop, :authentication_timeout, state}

  def handle_info(_message, state), do: {:ok, state}

  @impl true
  def terminate(_reason, _state), do: :ok

  defp handle_client_frame("ping", _frame, state), do: reply(%{type: "pong"}, state)

  defp handle_client_frame("auth", %{"accessToken" => token}, state) do
    case AccessTokenVerifier.verify_access_token_and_extract_principal(token) do
      {:ok, principal} ->
        state =
          subscribe_to_topic(%{state | principal: principal}, "user:#{principal.account_id}")

        reply(%{type: "auth.ok"}, state)

      {:error, _reason} ->
        {:stop, :invalid_access_token, {:text, Jason.encode!(%{type: "auth.failed"})}, state}
    end
  end

  defp handle_client_frame(_type, _frame, %{principal: nil} = state),
    do: reply(%{type: "error", code: "UNAUTHENTICATED"}, state)

  defp handle_client_frame("subscribe", %{"topic" => topic}, state) when is_binary(topic) do
    cond do
      MapSet.size(state.topics) >= @maximum_subscriptions ->
        reply(%{type: "error", code: "TOO_MANY_SUBSCRIPTIONS"}, state)

      TopicAuthorizer.authorize_subscription(state.principal, topic) == :ok ->
        reply(%{type: "subscribed", topic: topic}, subscribe_to_topic(state, topic))

      true ->
        reply(%{type: "error", code: "FORBIDDEN", topic: topic}, state)
    end
  end

  defp handle_client_frame("unsubscribe", %{"topic" => topic}, state) do
    PubSub.unsubscribe(Realtime.PubSub, topic)

    reply(%{type: "unsubscribed", topic: topic}, %{
      state
      | topics: MapSet.delete(state.topics, topic)
    })
  end

  defp handle_client_frame(
         "typing",
         %{"conversationId" => conversation_id, "isTyping" => typing?},
         state
       ) do
    topic = "conversation:#{conversation_id}"

    if MapSet.member?(state.topics, topic) do
      event = %{
        type: "typing",
        conversationId: conversation_id,
        user: %{id: state.principal.account_id},
        isTyping: typing? == true
      }

      PubSub.broadcast_from(Realtime.PubSub, self(), topic, {:realtime_event, topic, event})
    end

    {:ok, state}
  end

  defp handle_client_frame(_type, _frame, state),
    do: reply(%{type: "error", code: "UNKNOWN_FRAME_TYPE"}, state)

  defp subscribe_to_topic(state, topic) do
    if MapSet.member?(state.topics, topic) do
      state
    else
      PubSub.subscribe(Realtime.PubSub, topic)
      track_presence_on_live_topics(state.principal, topic)
      %{state | topics: MapSet.put(state.topics, topic)}
    end
  end

  defp track_presence_on_live_topics(principal, "live:" <> _ = topic),
    do: Presence.track(self(), topic, principal.account_id, %{joined_at: System.os_time(:second)})

  defp track_presence_on_live_topics(_principal, _topic), do: :ok

  defp revoke(state, candidates) do
    case SubscriptionGuard.revoked_topics(state.principal, candidates) do
      [] ->
        {:ok, state}

      revoked ->
        state = Enum.reduce(revoked, state, &drop_topic/2)
        {:push, {:text, Jason.encode!(%{type: "subscriptions.revoked", topics: revoked})}, state}
    end
  end

  defp drop_topic(topic, state) do
    PubSub.unsubscribe(Realtime.PubSub, topic)

    if String.starts_with?(topic, "live:"),
      do: Presence.untrack(self(), topic, state.principal.account_id)

    %{state | topics: MapSet.delete(state.topics, topic)}
  end

  defp schedule_subscription_recheck do
    Process.send_after(self(), :recheck_subscriptions, SubscriptionGuard.recheck_interval_ms())
  end

  defp reply(payload, state), do: {:reply, :ok, {:text, Jason.encode!(payload)}, state}
end
