defmodule Realtime.Events.RetryPolicy do
  @retry_exchange "nantty.retry"
  @maximum_delivery_attempts 5
  @attempt_header "x-nantty-attempt"
  @last_error_header "x-nantty-last-error"
  @tiers ["30s", "2m", "10m", "30m"]

  def retry_exchange, do: @retry_exchange
  def maximum_delivery_attempts, do: @maximum_delivery_attempts

  def retry_queue_name(queue, tier), do: "#{queue}.retry.#{tier}"

  def tier_after_failed_attempt(attempt)
      when is_integer(attempt) and attempt >= 1 and attempt < @maximum_delivery_attempts,
      do: {:ok, Enum.at(@tiers, min(attempt - 1, length(@tiers) - 1))}

  def tier_after_failed_attempt(_attempt), do: :dead_letter

  def attempt_from_headers(headers) when is_list(headers) do
    Enum.find_value(headers, 0, fn
      {@attempt_header, _type, value} when is_integer(value) -> value
      _other -> nil
    end)
  end

  def attempt_from_headers(_headers), do: 0

  def headers_for_retry(headers, failed_attempt, reason) do
    kept =
      if is_list(headers),
        do: Enum.reject(headers, fn {name, _type, _value} -> internal_header?(name) end),
        else: []

    message = reason |> inspect() |> String.slice(0, 256)
    kept ++ [{@attempt_header, :long, failed_attempt}, {@last_error_header, :longstr, message}]
  end

  defp internal_header?(name),
    do:
      name in [@attempt_header, @last_error_header] or
        String.starts_with?(name, ["x-death", "x-first-death", "x-last-death"])
end
