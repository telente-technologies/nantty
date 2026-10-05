defmodule Realtime.Events.ConversationEventRouter do
  @moduledoc false
  alias Phoenix.PubSub

  @client_types %{
    "message.created" => "message.created",
    "message.updated" => "message.updated",
    "message.removed" => "message.removed",
    "message.reactionsChanged" => "reaction",
    "conversation.read" => "read",
    "conversation.updated" => "conversation.updated"
  }

  @audience_keys ["recipientIds", "memberIds"]

  def conversation_event?(%{"type" => type}), do: is_map_key(@client_types, type)
  def conversation_event?(_event), do: false

  def route(%{"type" => "conversation.updated", "data" => %{"accountId" => account_id} = data})
      when is_binary(account_id) and account_id != "",
      do: {:ok, "user:#{account_id}", client_payload("conversation.updated", data)}

  def route(%{"type" => type, "data" => %{"conversationId" => conversation_id} = data})
      when is_map_key(@client_types, type) and is_binary(conversation_id) and
             conversation_id != "",
      do: {:ok, "conversation:#{conversation_id}", client_payload(type, data)}

  def route(_event), do: :ignore

  def fanout_account_ids(%{"type" => type, "data" => %{"accountId" => account_id}})
      when type == "conversation.updated" and is_binary(account_id),
      do: []

  def fanout_account_ids(%{"type" => type, "data" => %{} = data})
      when is_map_key(@client_types, type) do
    sender =
      case data["message"] do
        %{"senderId" => sender_id} -> [sender_id]
        _ -> []
      end

    @audience_keys
    |> Enum.flat_map(&List.wrap(data[&1]))
    |> Kernel.++(sender)
    |> Enum.filter(&(is_binary(&1) and &1 != ""))
    |> Enum.uniq()
  end

  def fanout_account_ids(_event), do: []

  def broadcast(event) do
    with {:ok, "conversation:" <> conversation_id = topic, payload} <- route(event) do
      PubSub.broadcast(Realtime.PubSub, topic, {:realtime_event, topic, payload})

      for account_id <- fanout_account_ids(event) do
        user_topic = "user:#{account_id}"

        PubSub.broadcast(
          Realtime.PubSub,
          user_topic,
          {:conversation_fanout, conversation_id, payload}
        )
      end

      :ok
    else
      {:ok, topic, payload} ->
        PubSub.broadcast(Realtime.PubSub, topic, {:realtime_event, topic, payload})

      :ignore ->
        :ok
    end
  end

  def personalize(%{"type" => "reaction", "reactions" => reactions} = payload, account_id)
      when is_list(reactions),
      do: %{payload | "reactions" => Enum.map(reactions, &personal_reaction(&1, account_id))}

  def personalize(payload, _account_id), do: payload

  defp personal_reaction(%{"accountIds" => ids} = reaction, account_id) when is_list(ids) do
    reaction
    |> Map.delete("accountIds")
    |> Map.put("reactedByMe", account_id in ids)
  end

  defp personal_reaction(reaction, _account_id), do: reaction

  defp client_payload("message.created", data),
    do: %{
      "type" => "message.created",
      "conversationId" => data["conversationId"],
      "message" => data["message"]
    }

  defp client_payload(type, data) do
    data
    |> Map.drop(@audience_keys)
    |> Map.put("type", Map.fetch!(@client_types, type))
  end
end
