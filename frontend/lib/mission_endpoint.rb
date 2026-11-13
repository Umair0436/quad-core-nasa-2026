require "base64"
require_relative "mission_engine"

module MissionEndpoint
  class InvalidToken < StandardError; end

  TOKEN_LIFETIME = 7_200

  def self.call(request, response, decision:)
    response["Content-Type"] = "application/json; charset=utf-8"
    response["Cache-Control"] = "no-store"
    unless request.request_method == "POST"
      response["Allow"] = "POST"
      return render(response, 405, error: "Use POST to play a mission.")
    end

    history = []
    started_at = Time.now.to_i
    result = MissionEngine.start
    if decision
      body = JSON.parse(request.body.to_s)
      unless body.is_a?(Hash) && %w[token action_id].all? { |key| body[key].is_a?(String) && !body[key].empty? }
        return render(response, 400, error: "A mission token and action are required.")
      end

      started_at, history = read_token(body.fetch("token"))
      # A public single-player mission can be replayed from its choices.
      # Recalculate every turn server-side so client input never supplies resource values.
      history.each { |action| result = MissionEngine.resolve(result.fetch(:state), action) }
      result = MissionEngine.resolve(result.fetch(:state), body.fetch("action_id"))
      history << body.fetch("action_id")
    end

    render(response, 200, result.merge(
      decision: MissionEngine.decision_for(result.fetch(:state)),
      rules: {
        daily_costs: MissionEngine::DAILY_COST,
        radiation_limit: MissionEngine::RADIATION_LIMIT,
        mission_days: MissionEngine.decisions.length
      },
      token: Base64.urlsafe_encode64(JSON.generate([started_at, history]), padding: false)
    ))
  rescue JSON::ParserError
    render(response, 400, error: "Send a JSON request.")
  rescue InvalidToken
    render(response, 422, error: "Your mission expired or could not be read. Start a new mission.")
  rescue MissionEngine::InvalidAction => error
    render(response, 422, error: error.message)
  end

  def self.read_token(token)
    raise InvalidToken if token.bytesize > 512

    data = JSON.parse(Base64.urlsafe_decode64(token))
    raise InvalidToken unless data.is_a?(Array) && data.length == 2

    started_at, history = data
    raise InvalidToken unless started_at.is_a?(Integer) && (0..TOKEN_LIFETIME).cover?(Time.now.to_i - started_at)
    raise InvalidToken unless history.is_a?(Array) && history.length <= MissionEngine.decisions.length && history.all? { |action| action.is_a?(String) }

    [started_at, history]
  rescue ArgumentError, JSON::ParserError
    raise InvalidToken
  end

  def self.render(response, status, body)
    response.status = status
    response.body = JSON.generate(body)
  end
end
