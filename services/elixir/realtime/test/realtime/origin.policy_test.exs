defmodule RealtimeWeb.OriginPolicyTest do
  use ExUnit.Case, async: false

  alias RealtimeWeb.OriginPolicy

  setup do
    previous = Application.get_env(:realtime, :allowed_origins)
    Application.put_env(:realtime, :allowed_origins, ["https://nantty.test"])

    on_exit(fn ->
      if previous,
        do: Application.put_env(:realtime, :allowed_origins, previous),
        else: Application.delete_env(:realtime, :allowed_origins)
    end)

    :ok
  end

  test "allows native clients with no Origin so token auth can run on connect" do
    assert OriginPolicy.allowed_origin?(nil)
  end

  test "normalizes an allowed browser origin and rejects untrusted or malformed origins" do
    assert OriginPolicy.allowed_origin?(URI.parse("https://nantty.test/any/path"))
    refute OriginPolicy.allowed_origin?(URI.parse("https://attacker.test"))
    refute OriginPolicy.allowed_origin?("not a URI")
  end
end
