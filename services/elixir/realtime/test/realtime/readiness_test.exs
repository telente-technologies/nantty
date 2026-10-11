defmodule Realtime.ReadinessTest do
  use ExUnit.Case, async: true
  alias Realtime.Readiness

  defmodule FakeConsumer do
    use GenServer
    def start_link(connected?), do: GenServer.start_link(__MODULE__, connected?)
    @impl true
    def init(connected?), do: {:ok, connected?}
    @impl true
    def handle_call(:connected?, _from, :hang), do: Process.sleep(5_000) && {:reply, true, :hang}
    def handle_call(:connected?, _from, connected?), do: {:reply, connected?, connected?}
  end

  test "ready when the broker consumer holds a channel" do
    {:ok, consumer} = FakeConsumer.start_link(true)
    assert Readiness.check(consumer, true) == :ok
  end

  test "not ready while the broker consumer is reconnecting" do
    {:ok, consumer} = FakeConsumer.start_link(false)
    assert Readiness.check(consumer, true) == {:error, :rabbitmq}
  end

  test "not ready when the consumer is missing or does not answer in time" do
    assert Readiness.check(:no_such_consumer, true) == {:error, :rabbitmq}
    {:ok, consumer} = FakeConsumer.start_link(:hang)
    assert Readiness.check(consumer, true) == {:error, :rabbitmq}
  end

  test "ready without a broker when the consumer is disabled" do
    assert Readiness.check(:no_such_consumer, false) == :ok
  end
end
