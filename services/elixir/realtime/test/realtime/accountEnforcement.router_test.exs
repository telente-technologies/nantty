defmodule Realtime.Events.AccountEnforcementRouterTest do
  use ExUnit.Case, async: false
  alias Phoenix.PubSub
  alias Realtime.Auth.RevocationList
  alias Realtime.Events.AccountEnforcementRouter

  test "suspensions and bans close every socket and refuse older tokens" do
    for type <- ["account.suspended", "account.banned"] do
      account_id = "acc-#{type}"
      PubSub.subscribe(Realtime.PubSub, "user:#{account_id}")
      issued_at = System.os_time(:second) - 5

      AccountEnforcementRouter.enforce(%{"type" => type, "data" => %{"accountId" => account_id}})

      assert_receive {:disconnect, :all, ^type}

      assert RevocationList.revoked?(%{
               account_id: account_id,
               session_id: "s",
               issued_at: issued_at
             })

      refute RevocationList.revoked?(%{
               account_id: account_id,
               session_id: "s",
               issued_at: System.os_time(:second) + 60
             })
    end
  end

  test "a revoked session closes only that session and refuses its tokens" do
    PubSub.subscribe(Realtime.PubSub, "user:acc-s")

    AccountEnforcementRouter.enforce(%{
      "type" => "session.revoked",
      "data" => %{"accountId" => "acc-s", "sessionId" => "sid-1", "reason" => "logout"}
    })

    assert_receive {:disconnect, {:session, "sid-1"}, "session.revoked"}
    assert RevocationList.revoked?(%{account_id: "acc-s", session_id: "sid-1", issued_at: 0})
    refute RevocationList.revoked?(%{account_id: "acc-s", session_id: "sid-2", issued_at: 0})
  end

  test "revoking all other sessions closes the account's sockets without refusing new tokens" do
    PubSub.subscribe(Realtime.PubSub, "user:acc-all")

    AccountEnforcementRouter.enforce(%{
      "type" => "session.revoked",
      "data" => %{"accountId" => "acc-all", "sessionId" => "*", "reason" => "revoke_all"}
    })

    assert_receive {:disconnect, :all, "session.revoked"}
    refute RevocationList.revoked?(%{account_id: "acc-all", session_id: "sid", issued_at: 0})
  end

  test "ignores unrelated events" do
    assert AccountEnforcementRouter.decide(%{
             "type" => "account.warned",
             "data" => %{"accountId" => "a"}
           }) ==
             :ignore
  end
end
