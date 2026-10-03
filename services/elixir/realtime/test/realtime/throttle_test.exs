defmodule Realtime.Events.ThrottleTest do
  use ExUnit.Case, async: true
  alias Realtime.Events.Throttle

  setup do
    {:ok, clock} = Agent.start_link(fn -> 0 end)
    test_pid = self()

    {:ok, throttle} =
      GenServer.start_link(Throttle,
        clock: fn -> Agent.get(clock, & &1) end,
        schedule_flush: fn key, delay -> send(test_pid, {:flush_scheduled, key, delay}) end
      )

    %{throttle: throttle, advance: fn ms -> Agent.update(clock, &(&1 + ms)) end}
  end

  defp submit_from_test(throttle, key, value, interval) do
    test_pid = self()
    Throttle.submit(throttle, key, interval, fn -> send(test_pid, {:delivered, value}) end)
  end

  test "delivers the first event immediately", %{throttle: throttle} do
    assert :delivered == submit_from_test(throttle, :k, 1, 1_000)
    assert_received {:delivered, 1}
  end

  test "holds the latest event inside the window and flushes it once", %{
    throttle: throttle,
    advance: advance
  } do
    submit_from_test(throttle, :k, 1, 1_000)
    assert_received {:delivered, 1}
    advance.(300)
    assert :throttled == submit_from_test(throttle, :k, 2, 1_000)
    assert :throttled == submit_from_test(throttle, :k, 3, 1_000)
    assert_received {:flush_scheduled, :k, 700}
    refute_received {:flush_scheduled, :k, _}
    refute_received {:delivered, 2}

    advance.(700)
    send(throttle, {:flush, :k})
    :sys.get_state(throttle)
    assert_received {:delivered, 3}
    refute_received {:delivered, 2}

    send(throttle, {:flush, :k})
    :sys.get_state(throttle)
    refute_received {:delivered, _}
  end

  test "delivers again after the window and keeps keys independent", %{
    throttle: throttle,
    advance: advance
  } do
    submit_from_test(throttle, :a, 1, 500)
    assert :delivered == submit_from_test(throttle, :b, 2, 500)
    advance.(500)
    assert :delivered == submit_from_test(throttle, :a, 3, 500)
    assert_received {:delivered, 3}
  end

  test "a failing delivery does not crash the throttle", %{throttle: throttle} do
    assert :delivered == Throttle.submit(throttle, :k, 10, fn -> raise "boom" end)
    assert Process.alive?(throttle)
  end
end
