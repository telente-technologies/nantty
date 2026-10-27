defmodule Realtime.Events.RetryPolicyTest do
  use ExUnit.Case, async: true
  alias Realtime.Events.RetryPolicy

  test "backs off exponentially and dead-letters on the fifth failure" do
    tiers = for attempt <- 1..4, do: RetryPolicy.tier_after_failed_attempt(attempt)
    assert tiers == [{:ok, "30s"}, {:ok, "2m"}, {:ok, "10m"}, {:ok, "30m"}]
    assert RetryPolicy.tier_after_failed_attempt(5) == :dead_letter
  end

  test "reads the attempt header and replaces broker death headers on retry" do
    headers = [
      {"x-nantty-attempt", :long, 2},
      {"x-death", :array, []},
      {"traceparent", :longstr, "t"}
    ]

    assert RetryPolicy.attempt_from_headers(headers) == 2
    assert RetryPolicy.attempt_from_headers(:undefined) == 0
    retry = RetryPolicy.headers_for_retry(headers, 3, :boom)
    assert {"x-nantty-attempt", :long, 3} in retry
    assert {"traceparent", :longstr, "t"} in retry
    refute Enum.any?(retry, fn {name, _type, _value} -> name == "x-death" end)
    assert RetryPolicy.retry_queue_name("q", "2m") == "q.retry.2m"
  end
end
