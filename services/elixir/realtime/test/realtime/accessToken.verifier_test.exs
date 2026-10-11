defmodule Realtime.Auth.AccessTokenVerifierTest do
  use ExUnit.Case, async: false
  alias Realtime.Auth.{AccessTokenVerifier, JwksKeyCache}

  setup do
    private_jwk = JOSE.JWK.generate_key({:okp, :Ed25519})
    {_, public_map} = private_jwk |> JOSE.JWK.to_public() |> JOSE.JWK.to_map()

    JwksKeyCache.put_keys_for_tests([
      Map.merge(public_map, %{"kid" => "test-kid", "alg" => "EdDSA"})
    ])

    %{private_jwk: private_jwk}
  end

  defp sign(private_jwk, claims) do
    base = %{
      "iss" => "https://auth.zudomart.test",
      "aud" => ["zudomart-realtime"],
      "scope" => "realtime",
      "sub" => "account-1",
      "sid" => "session-1",
      "exp" => System.os_time(:second) + 300
    }

    {_, token} =
      JOSE.JWT.sign(
        private_jwk,
        %{"alg" => "EdDSA", "kid" => "test-kid"},
        Map.merge(base, claims)
      )
      |> JOSE.JWS.compact()

    token
  end

  test "accepts a valid token and extracts the principal", %{private_jwk: jwk} do
    assert {:ok, %{account_id: "account-1", session_id: "session-1"}} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(sign(jwk, %{}))
  end

  test "rejects expired, wrong audience and garbage tokens", %{private_jwk: jwk} do
    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(
               sign(jwk, %{"exp" => System.os_time(:second) - 120})
             )

    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(
               sign(jwk, %{"aud" => ["zudomart-admin"]})
             )

    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal("not.a.token")
  end

  test "accepts only realtime-scoped socket tokens, never session access or widget tokens", %{
    private_jwk: jwk
  } do
    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(
               sign(jwk, %{"aud" => ["zudomart-api"], "scope" => nil})
             )

    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(
               sign(jwk, %{"scope" => "widgets:read"})
             )

    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(
               sign(jwk, %{"aud" => ["zudomart-widgets"], "scope" => "realtime"})
             )

    assert {:error, _} =
             AccessTokenVerifier.verify_access_token_and_extract_principal(
               sign(jwk, %{} |> Map.put("scope", nil))
             )
  end
end
