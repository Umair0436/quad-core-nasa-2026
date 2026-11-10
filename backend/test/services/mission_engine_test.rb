require "test_helper"

class MissionEngineTest < ActiveSupport::TestCase
  def play(*actions)
    actions.reduce(MissionEngine.start) { |result, action| MissionEngine.resolve(result[:state], action) }
  end

  test "a crew can survive three days" do
    result = play("conserve", "shelter", "harvest")
    assert_equal "won", result[:state]["status"]
    assert_nil MissionEngine.decision_for(result[:state])
  end

  test "a last-day power shortage loses before checking for a win" do
    result = play("recycle", "shelter", "harvest")
    assert_equal "lost", result[:state]["status"]
    assert_equal 0, result[:state]["power"]
  end

  test "outside work can exceed the exposure limit" do
    result = play("recycle", "collect", "solar")
    assert_equal "lost", result[:state]["status"]
    assert_match(/Exposure/, result[:reason])
  end

  test "an action from another day is rejected without changing state" do
    state = MissionEngine.start[:state]
    assert_raises(MissionEngine::InvalidAction) { MissionEngine.resolve(state, "harvest") }
    assert_equal MissionEngine::INITIAL_STATE, state
  end

  test "completed missions cannot take another action" do
    state = play("conserve", "shelter", "harvest")[:state]
    assert_raises(MissionEngine::InvalidAction) { MissionEngine.resolve(state, "harvest") }
  end

  test "every path stays within resource bounds and restart resets the state" do
    choices = MissionEngine.decisions.map { |day| day["choices"].map { |choice| choice["id"] } }
    choices.first.product(*choices.drop(1)).each do |path|
      result = play(*path)
      MissionEngine::RESOURCES.each { |resource| assert_includes 0..100, result[:state][resource] }
    end
    assert_equal MissionEngine::INITIAL_STATE, MissionEngine.start[:state]
  end
end
