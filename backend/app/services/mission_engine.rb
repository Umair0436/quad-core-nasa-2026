# Simplified game points, not NASA measurements or a physical simulation.
class MissionEngine
  class InvalidAction < StandardError; end
  RESOURCES = %w[oxygen power food radiation].freeze
  DAILY_COST = { "oxygen" => -14, "power" => -10, "food" => -12 }.freeze
  INITIAL_STATE = { "day" => 1, "oxygen" => 62, "power" => 70, "food" => 60, "radiation" => 10, "status" => "playing" }.freeze

  def self.decisions
    @decisions ||= JSON.parse(Rails.root.join("config/missions.json").read)
  end

  def self.start
    { state: INITIAL_STATE.dup, feedback: nil, reason: nil }
  end

  def self.decision_for(state)
    return unless state.fetch("status") == "playing"
    decision = decisions.fetch(state.fetch("day") - 1)
    decision.merge("choices" => decision["choices"].map { |choice| choice.except("explanation") })
  end

  def self.resolve(state, action_id)
    raise InvalidAction, "This mission has ended. Start a new mission to play again." unless state.fetch("status") == "playing"
    decision = decisions.fetch(state.fetch("day") - 1)
    choice = decision["choices"].find { |item| item["id"] == action_id }
    raise InvalidAction, "Choose an action from the current mission day." unless choice

    next_state = state.dup
    RESOURCES.each do |resource|
      change = choice["effects"].fetch(resource, 0) + DAILY_COST.fetch(resource, 0)
      next_state[resource] = (state.fetch(resource) + change).clamp(0, 100)
    end

    reason = if next_state["oxygen"].zero?
      "The crew ran out of oxygen. Try saving more air for later days."
    elsif next_state["power"].zero?
      "The outpost ran out of power. Keep an energy reserve for life support."
    elsif next_state["food"].zero?
      "The crew ran out of food. Plan a harvest before supplies get too low."
    elsif next_state["radiation"] >= 80
      "Exposure reached the game's safety limit. Try spending less time outside."
    end

    if reason
      next_state["status"] = "lost"
    elsif state["day"] == decisions.length
      next_state["status"] = "won"
      reason = "Your crew made it through all three days. Every resource decision mattered."
    else
      next_state["day"] += 1
    end

    {
      state: next_state,
      feedback: choice["explanation"] + " At the end of each day, the crew also uses 14 oxygen, 10 power, and 12 food points.",
      reason: reason
    }
  end
end
