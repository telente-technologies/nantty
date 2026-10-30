defmodule RealtimeWeb.OriginPolicy do
  # Native clients authenticate with a short-lived, scoped socket token in the
  # first frame; they do not send a browser Origin header.
  def allowed_origin?(nil), do: true

  def allowed_origin?(%URI{} = origin) do
    allowed = Application.get_env(:realtime, :allowed_origins, [])
    allowed == ["*"] or URI.to_string(%URI{origin | path: nil}) in allowed
  end

  def allowed_origin?(_origin), do: false
end
