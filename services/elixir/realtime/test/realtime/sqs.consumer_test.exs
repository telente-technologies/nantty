defmodule Realtime.Events.SqsConsumerTest do
  use ExUnit.Case, async: true
  alias Realtime.Events.SqsConsumer

  defmodule FakeQueueClient do
    @behaviour Realtime.Events.QueueClient

    @impl true
    def resolve_queue_url(_name), do: {:ok, "fake://queue"}

    @impl true
    def receive_messages(_url) do
      Agent.get_and_update(Application.fetch_env!(:realtime, :fake_queue), fn
        [batch | rest] -> {{:ok, batch}, rest}
        [] -> {{:ok, []}, []}
      end)
    end

    @impl true
    def delete_message(_url, handle) do
      send(Application.fetch_env!(:realtime, :fake_queue_owner), {:deleted, handle})
      :ok
    end
  end

  setup do
    {:ok, queue} = Agent.start_link(fn -> [] end)
    Application.put_env(:realtime, :fake_queue, queue)
    Application.put_env(:realtime, :fake_queue_owner, self())
    %{queue: queue}
  end

  defp envelope(id, type \\ "gift.sent"),
    do: Jason.encode!(%{"id" => id, "type" => type, "data" => %{"liveId" => "l-1"}})

  defp start_consumer(queue, batches) do
    test_pid = self()
    Agent.update(queue, fn _ -> batches end)

    start_supervised!(
      {SqsConsumer,
       client: FakeQueueClient,
       queue_name: "q",
       idle_delay_ms: 5,
       broadcast: fn event ->
         send(test_pid, {:broadcast, event["id"]})
         if event["type"] == "explode", do: raise("boom")
         :ok
       end}
    )
  end

  test "broadcasts and deletes a valid message", %{queue: queue} do
    start_consumer(queue, [[%{body: envelope("e-1"), receipt_handle: "h-1"}]])
    assert_receive {:broadcast, "e-1"}
    assert_receive {:deleted, "h-1"}
  end

  test "keeps malformed messages on the queue", %{queue: queue} do
    start_consumer(queue, [
      [
        %{body: "not json", receipt_handle: "h-bad"},
        %{body: "{\"x\":1}", receipt_handle: "h-bad2"}
      ]
    ])

    refute_receive {:deleted, _}, 100
    refute_received {:broadcast, _}
  end

  test "keeps messages whose broadcast fails", %{queue: queue} do
    start_consumer(queue, [[%{body: envelope("e-2", "explode"), receipt_handle: "h-2"}]])
    assert_receive {:broadcast, "e-2"}
    refute_receive {:deleted, "h-2"}, 100
  end

  test "broadcasts a duplicated envelope id once but deletes both copies", %{queue: queue} do
    start_consumer(queue, [
      [%{body: envelope("e-3"), receipt_handle: "h-3a"}],
      [%{body: envelope("e-3"), receipt_handle: "h-3b"}]
    ])

    assert_receive {:deleted, "h-3a"}
    assert_receive {:deleted, "h-3b"}
    assert_received {:broadcast, "e-3"}
    refute_received {:broadcast, "e-3"}
  end
end
