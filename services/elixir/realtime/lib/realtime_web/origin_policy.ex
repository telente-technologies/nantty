defmodule RealtimeWeb.OriginPolicy do
  def allowed_origin?(%URI{} = origin) do
    allowed = Application.get_env(:realtime, :allowed_origins, [])
    allowed == ["*"] or URI.to_string(%URI{origin | path: nil}) in allowed
  end
end
