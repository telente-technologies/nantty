defmodule Realtime.Events.AwsSignatureV4 do
  def sign_post_request(%{
        host_header: host_header,
        region: region,
        service: service,
        access_key_id: access_key_id,
        secret_access_key: secret_access_key,
        target: target,
        body: body,
        now: now
      }) do
    amz_date = Calendar.strftime(now, "%Y%m%dT%H%M%SZ")
    date = String.slice(amz_date, 0, 8)
    content_type = "application/x-amz-json-1.0"

    signed_headers = "content-type;host;x-amz-date;x-amz-target"

    canonical_headers =
      "content-type:#{content_type}\nhost:#{host_header}\nx-amz-date:#{amz_date}\nx-amz-target:#{target}\n"

    canonical_request =
      Enum.join(["POST", "/", "", canonical_headers, signed_headers, hex_sha256(body)], "\n")

    scope = "#{date}/#{region}/#{service}/aws4_request"

    string_to_sign =
      Enum.join(["AWS4-HMAC-SHA256", amz_date, scope, hex_sha256(canonical_request)], "\n")

    signature =
      ("AWS4" <> secret_access_key)
      |> hmac(date)
      |> hmac(region)
      |> hmac(service)
      |> hmac("aws4_request")
      |> hmac(string_to_sign)
      |> Base.encode16(case: :lower)

    %{
      "content-type" => content_type,
      "x-amz-date" => amz_date,
      "x-amz-target" => target,
      "authorization" =>
        "AWS4-HMAC-SHA256 Credential=#{access_key_id}/#{scope}, SignedHeaders=#{signed_headers}, Signature=#{signature}"
    }
  end

  defp hmac(key, data), do: :crypto.mac(:hmac, :sha256, key, data)
  defp hex_sha256(data), do: :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
end
