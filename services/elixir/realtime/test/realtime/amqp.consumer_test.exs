defmodule Realtime.Events.AmqpConsumerTest do
  use ExUnit.Case, async: true
  alias Realtime.Events.AmqpConsumer

  defmodule FakeBrokerClient do
    @behaviour Realtime.Events.BrokerClient

    @impl true
    def open(settings) do
      owner = Keyword.fetch!(settings, :owner)

      channel_pid =
        spawn(fn ->
          receive do
            :stop -> :ok
          end
        end)

      send(owner, {:opened, channel_pid})

      {:ok,
       %{
         pid: channel_pid,
         owner: owner,
         fail_publish: settings[:fail_publish] == true,
         unroutable: settings[:unroutable] == true
       }}
    end

    @impl true
    def channel_process(%{pid: pid}), do: pid

    @impl true
    def consume(channel, queue, prefetch) do
      send(channel.owner, {:consuming, queue, prefetch})
      {:ok, "ctag"}
    end

    @impl true
    def ack(channel, tag) do
      send(channel.owner, {:acked, tag})
      :ok
    end

    @impl true
    def reject(channel, tag, requeue) do
      send(channel.owner, {:rejected, tag, requeue})
      :ok
    end

    @impl true
    def publish_confirmed(channel, exchange, routing_key, _payload, options) do
      send(channel.owner, {:published, exchange, routing_key, options})

      cond do
        channel.unroutable -> {:error, :unroutable}
        channel.fail_publish -> {:error, :nacked}
        true -> :ok
      end
    end

    @impl true
    def close(_channel), do: :ok
  end

  defp envelope(id, type \\ "gift.sent"),
    do: Jason.encode!(%{"id" => id, "type" => type, "data" => %{"liveId" => "l-1"}})

  defp start_consumer(settings \\ []) do
    test_pid = self()

    pid =
      start_supervised!(
        {AmqpConsumer,
         client: FakeBrokerClient,
         settings: Keyword.put(settings, :owner, test_pid),
         queue_name: "realtime-domain-events",
         prefetch: 25,
         backoff: fn _attempt -> 5 end,
         broadcast: fn event ->
           send(test_pid, {:broadcast, event["id"]})
           if event["type"] == "explode", do: raise("boom")
           :ok
         end}
      )

    assert_receive {:consuming, "realtime-domain-events", 25}
    pid
  end

  defp deliver(pid, tag, body, attempt \\ 0) do
    headers = if attempt > 0, do: [{"x-nantty-attempt", :long, attempt}], else: :undefined
    meta = %{delivery_tag: tag, headers: headers, message_id: "m-#{tag}", type: "gift.sent"}
    send(pid, {:basic_deliver, body, meta})
  end

  test "broadcasts and acknowledges a valid domain event" do
    pid = start_consumer()
    deliver(pid, 1, envelope("e-1"))
    assert_receive {:broadcast, "e-1"}
    assert_receive {:acked, 1}
  end

  test "dead-letters malformed messages without broadcasting" do
    pid = start_consumer()
    deliver(pid, 1, "not json")
    deliver(pid, 2, ~s({"x":1}))
    assert_receive {:rejected, 1, false}
    assert_receive {:rejected, 2, false}
    refute_received {:broadcast, _}
  end

  test "schedules the first retry tier when the broadcast fails" do
    pid = start_consumer()
    deliver(pid, 3, envelope("e-2", "explode"))
    assert_receive {:published, "nantty.retry", "realtime-domain-events.retry.30s", options}
    assert {"x-nantty-attempt", :long, 1} in options[:headers]
    assert options[:message_id] == "m-3"
    assert_receive {:acked, 3}
  end

  test "dead-letters after the last attempt" do
    pid = start_consumer()
    deliver(pid, 4, envelope("e-3", "explode"), 4)
    assert_receive {:rejected, 4, false}
    refute_received {:published, _, _, _}
  end

  test "requeues when the retry cannot be confirmed" do
    pid = start_consumer(fail_publish: true)
    deliver(pid, 5, envelope("e-4", "explode"))
    assert_receive {:rejected, 5, true}
  end

  test "dead-letters the original delivery when a confirmed retry is unroutable" do
    pid = start_consumer(unroutable: true)
    deliver(pid, 8, envelope("e-unroutable", "explode"))

    assert_receive {:rejected, 8, false}
    refute_received {:acked, 8}
  end

  test "broadcasts a duplicated envelope id once but acknowledges both copies" do
    pid = start_consumer()
    deliver(pid, 6, envelope("e-5"))
    deliver(pid, 7, envelope("e-5"))
    assert_receive {:acked, 6}
    assert_receive {:acked, 7}
    assert_received {:broadcast, "e-5"}
    refute_received {:broadcast, "e-5"}
  end

  test "reconnects when the channel process dies" do
    _pid = start_consumer()
    assert_received {:opened, channel_pid}
    send(channel_pid, :stop)
    assert_receive {:opened, _new_channel}
    assert_receive {:consuming, "realtime-domain-events", 25}
  end
end
