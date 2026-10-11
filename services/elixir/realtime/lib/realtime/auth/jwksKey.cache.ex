defmodule Realtime.Auth.JwksKeyCache do
  use GenServer
  require Logger

  @refresh_interval_ms :timer.minutes(5)
  @on_demand_refresh_gap_ms :timer.seconds(30)
  @table __MODULE__

  def start_link(options), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  def find_signing_key_by_id(key_id) do
    case :ets.lookup(@table, key_id) do
      [{^key_id, jwk}] -> {:ok, jwk}
      [] -> refresh_now_and_find(key_id)
    end
  end

  def put_keys_for_tests(jwk_maps), do: store_keys(jwk_maps)

  @impl true
  def init(options) do
    :ets.new(@table, [:named_table, :public, read_concurrency: true])
    send(self(), :refresh)
    {:ok, %{jwks_url: Keyword.fetch!(options, :jwks_url), on_demand_at: nil}}
  end

  @impl true
  def handle_info(:refresh, state) do
    fetch_and_store_keys(state.jwks_url)
    Process.send_after(self(), :refresh, @refresh_interval_ms)
    {:noreply, state}
  end

  @impl true
  def handle_call(:refresh_now, _from, state) do
    now = System.monotonic_time(:millisecond)

    if state.on_demand_at != nil and now - state.on_demand_at < @on_demand_refresh_gap_ms,
      do: {:reply, :throttled, state},
      else: {:reply, fetch_and_store_keys(state.jwks_url), %{state | on_demand_at: now}}
  end

  defp refresh_now_and_find(key_id) do
    GenServer.call(__MODULE__, :refresh_now, 10_000)

    case :ets.lookup(@table, key_id) do
      [{^key_id, jwk}] -> {:ok, jwk}
      [] -> {:error, :unknown_signing_key}
    end
  end

  defp fetch_and_store_keys(""), do: :skipped

  defp fetch_and_store_keys(jwks_url) do
    request = {String.to_charlist(jwks_url), [{~c"accept", ~c"application/json"}]}

    with {:ok, {{_, 200, _}, _headers, body}} <-
           :httpc.request(:get, request, [timeout: 5_000], body_format: :binary),
         {:ok, %{"keys" => keys}} <- Jason.decode(body) do
      store_keys(keys)
    else
      failure ->
        Logger.warning("could not refresh JWKS: #{inspect(failure)}")
        :error
    end
  end

  defp store_keys(keys) do
    Enum.each(keys, fn %{"kid" => key_id} = key ->
      :ets.insert(@table, {key_id, JOSE.JWK.from_map(key)})
    end)

    :ok
  end
end
