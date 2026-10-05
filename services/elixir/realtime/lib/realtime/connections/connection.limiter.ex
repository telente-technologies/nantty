defmodule Realtime.Connections.ConnectionLimiter do
  @moduledoc false

  @registry Realtime.ConnectionRegistry
  @default_connections_per_user 5
  @default_frames_per_minute 120
  @window_ms 60_000

  def registry, do: @registry

  def register(account_id) do
    opened_at = System.monotonic_time(:microsecond)
    {:ok, _owner} = Registry.register(@registry, account_id, opened_at)
    evict_oldest_beyond_cap(account_id)
  end

  def evict_oldest_beyond_cap(account_id) do
    cap = Application.get_env(:realtime, :max_connections_per_user, @default_connections_per_user)

    @registry
    |> Registry.lookup(account_id)
    |> Enum.sort_by(fn {_pid, opened_at} -> opened_at end, :desc)
    |> Enum.drop(cap)
    |> Enum.each(fn {pid, _opened_at} -> send(pid, :connection_replaced) end)
  end

  def new_frame_window, do: %{started_at: System.monotonic_time(:millisecond), count: 0}

  def count_frame(%{started_at: started_at, count: count}) do
    now = System.monotonic_time(:millisecond)
    limit = Application.get_env(:realtime, :client_frames_per_minute, @default_frames_per_minute)

    window =
      if now - started_at >= @window_ms,
        do: %{started_at: now, count: 1},
        else: %{started_at: started_at, count: count + 1}

    if window.count > limit, do: {:limited, window}, else: {:ok, window}
  end
end
