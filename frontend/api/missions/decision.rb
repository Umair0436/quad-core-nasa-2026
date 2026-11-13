require_relative "../../lib/mission_endpoint"

Handler = proc { |request, response| MissionEndpoint.call(request, response, decision: true) }
