defmodule Realtime.Presence.LivePresenceForwarderTest do
  use ExUnit.Case, async: true
  alias Realtime.Presence.LivePresenceForwarder

  defmodule SendingClient do
    def send_presence_change(live_id, joined, left) do
      send(Application.fetch_env!(:realtime, :presence_test_pid), {:forwarded, live_id, Enum.sort(joined), Enum.sort(left)})
    end
  end

  test "merges changes per live into one call and lets the latest change win" do
    Application.put_env(:realtime, :presence_test_pid, self())
    name = :presence_forwarder_under_test
    start_supervised!({LivePresenceForwarder, name: name, flush_ms: 50, client: SendingClient})

    LivePresenceForwarder.record_change(name, "l-1", ["a", "b"], [])
    LivePresenceForwarder.record_change(name, "l-1", ["c"], ["a"])
    LivePresenceForwarder.record_change(name, "l-2", [], ["z"])

    assert_receive {:forwarded, "l-1", ["b", "c"], ["a"]}, 1_000
    assert_receive {:forwarded, "l-2", [], ["z"]}, 1_000
    refute_receive {:forwarded, _, _, _}, 200
  end

  test "ignores changes when the forwarder is not running" do
    assert LivePresenceForwarder.record_change(:not_running_forwarder, "l-1", ["a"], []) == :ok
  end
end
