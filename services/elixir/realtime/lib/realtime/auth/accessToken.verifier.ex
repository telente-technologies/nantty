defmodule Realtime.Auth.AccessTokenVerifier do
  alias Realtime.Auth.JwksKeyCache
  alias Realtime.Auth.RevocationList

  @clock_skew_seconds 30

  def verify_access_token_and_extract_principal(token) when is_binary(token) do
    config = Application.fetch_env!(:realtime, :access_token)

    with {:ok, key_id} <- read_key_id(token),
         {:ok, jwk} <- JwksKeyCache.find_signing_key_by_id(key_id),
         {true, %JOSE.JWT{fields: claims}, _jws} <- JOSE.JWT.verify_strict(jwk, ["EdDSA"], token),
         :ok <- validate_standard_claims(claims, config),
         principal = principal_from_claims(claims),
         false <- RevocationList.revoked?(principal) do
      {:ok, principal}
    else
      _ -> {:error, :invalid_access_token}
    end
  end

  def verify_access_token_and_extract_principal(_), do: {:error, :invalid_access_token}

  defp principal_from_claims(claims) do
    %{
      account_id: claims["sub"],
      session_id: claims["sid"],
      roles: claims["roles"] || [],
      issued_at: if(is_integer(claims["iat"]), do: claims["iat"], else: 0)
    }
  end

  defp read_key_id(token) do
    with [encoded_header | _] <- String.split(token, "."),
         {:ok, header_json} <- Base.url_decode64(encoded_header, padding: false),
         {:ok, %{"kid" => key_id}} <- Jason.decode(header_json) do
      {:ok, key_id}
    else
      _ -> {:error, :malformed_token}
    end
  end

  defp validate_standard_claims(claims, config) do
    now = System.os_time(:second)
    audiences = List.wrap(claims["aud"])

    cond do
      claims["iss"] != Keyword.fetch!(config, :issuer) ->
        {:error, :wrong_issuer}

      Keyword.fetch!(config, :audience) not in audiences ->
        {:error, :wrong_audience}

      not is_integer(claims["exp"]) or claims["exp"] + @clock_skew_seconds < now ->
        {:error, :expired}

      not is_binary(claims["sub"]) or not is_binary(claims["sid"]) ->
        {:error, :missing_identity}

      true ->
        :ok
    end
  end
end
