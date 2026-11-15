"""Adapt the lunar model to short, replayable turns in the browser game."""

import random
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

LIB_DIR = Path(__file__).resolve().parent
MODEL_PATH = LIB_DIR / "lunar_model.py"  # Staged by the Vercel install command.
if not MODEL_PATH.is_file():
    MODEL_PATH = LIB_DIR.parent.parent / "ml" / "functions.py"

REQUIREMENTS = {
    "Oxygen Generation": 6.0,
    "Life Support": 8.0,
    "Scientific Research Laboratory": 5.0,
    "Artificial Lighting": 4.0,
    "Heating System": 5.0,
    "Radiation Protection": 5.0,
    "Communication": 2.0,
}
CROPS = ("lettuce", "tomato")
ACTIONS = ("wait", "clean", "water", "refill", "plant", "harvest", "store")
MISSIONS = ("oxygen", "food", "storm")
MAX_TURNS = 120
HOURS_PER_TURN = 4


def validate_request(payload):
    if not isinstance(payload, dict):
        raise ValueError("Expected a simulation request.")
    seed, turns = payload.get("seed"), payload.get("turns")
    mission = payload.get("mission")
    if mission is not None and mission not in MISSIONS:
        raise ValueError("Unknown training mission.")
    if type(seed) is not int or not 0 <= seed < 2**32:
        raise ValueError("Invalid weather seed.")
    if not isinstance(turns, list) or len(turns) > MAX_TURNS:
        raise ValueError("Invalid number of turns.")
    for turn in turns:
        if not isinstance(turn, dict) or turn.get("action") not in ACTIONS:
            raise ValueError("Unknown base action.")
        if not all(type(turn.get(key)) is int and 0 <= turn[key] <= maximum
                   for key, maximum in (("oxygen", 6), ("lighting", 4))):
            raise ValueError("Invalid power allocation.")
        if type(turn.get("shielding", 0)) is not int or not 0 <= turn.get("shielding", 0) <= 5:
            raise ValueError("Invalid shielding power.")
        if turn["action"] in ("plant", "harvest", "store") and turn.get("crop") not in CROPS:
            raise ValueError("Unknown crop.")
    return seed, mission, turns


def simulate(payload):
    seed, mission, turns = validate_request(payload)
    # Load a private model instance so each replay has its own reproducible weather.
    spec = spec_from_file_location("lunar_model", MODEL_PATH)
    model = module_from_spec(spec)
    spec.loader.exec_module(model)
    model.random = random.Random(seed)

    clock = model.LunarGameClock()
    weather = model.WeatherEnvironment()
    storms = model.SandstormGenerator()
    if mission:
        # Training forecasts are repeatable and reserve the solar particle event for its lesson.
        storms.hourly_chance = 0.0
    power = model.PowerGeneration(120, 100, .9, .9, 20, 27)
    plants = model.Plantation(10, 2, .5)
    inventory = {"seeds": {"lettuce": 5, "tomato": 3}, "greenhouse_capacity": 8, "water_liters": 10}
    growth = {"lettuce": [94.0], "tomato": [82.0]}
    temperature, cleanliness, oxygen = 20.0, 75.0, 100.0
    if mission == "oxygen":
        oxygen = 35.0
    elif mission == "food":
        clock.update(16 * clock.sol_duration_seconds / clock.LUNAR_HOURS_PER_SOL)
        growth = {"lettuce": [97.0], "tomato": [82.0]}
    stored_crops = {}
    exposure = 0.0
    simulated_hours = 0
    actions = {}
    storm_seen = False
    oxygen_use_per_day = 20
    oxygen_per_kw_per_day = 4

    def step(hours, allocations, player_actions):
        nonlocal inventory, growth, temperature, cleanliness, oxygen, exposure, simulated_hours
        state = model.update_lunar_mission(
            delta_seconds=hours * clock.sol_duration_seconds / clock.LUNAR_HOURS_PER_SOL,
            game_clock=clock, weather=weather, sandstorms=storms,
            power_generation=power, system_requirements_kw=REQUIREMENTS,
            player_allocations_kw=allocations, panel_cleanliness=cleanliness,
            plantation_system=plants, player_water_command="", greenhouse_growth=growth,
            life_support_settings={
                "current_oxygen": oxygen, "crew_count": 2,
                "oxygen_generation_per_kw_per_day": oxygen_per_kw_per_day,
                "oxygen_use_per_person_per_day": oxygen_use_per_day / 2,
                "shielding_status": 50.0,
            },
            maximum_lighting_kw=4, greenhouse_temperature_c=temperature,
            heating_settings={"temperature_rise_c_per_kwh": .035, "cooling_c_per_hour": .13},
            minimum_heating_kw=1, player_actions=player_actions, inventory=inventory,
        )
        inventory = state["inventory"]
        growth = state["greenhouse"]["growth"]
        temperature = state["greenhouse"]["temperature_c"]
        cleanliness = state["environment"]["panel_cleanliness"]
        oxygen_power = state["power"]["allocations"]["Oxygen Generation"]["allocated_kw"]
        simulated_hours += hours
        # The historical solar particle event is separate from the model's panel hazard.
        if mission == "storm" and 5 <= simulated_hours <= 8:
            shield_power = state["power"]["allocations"]["Radiation Protection"]["allocated_kw"]
            exposure += model.LifeSupportRadiation.calculate_radiation_level(
                state["clock"]["lunar_hour"], min(90, shield_power * 18),
                base_radiation=8, peak_sun_radiation=0,
            ) * hours
        generation = oxygen_power * oxygen_per_kw_per_day
        oxygen = min(100, max(0, oxygen + (generation - oxygen_use_per_day) * hours / 24))
        return state

    # A zero-hour forecast displays the initial conditions without consuming supplies.
    state = step(0, REQUIREMENTS, {})
    def failed():
        if oxygen <= 0:
            return "The base ran out of oxygen. Give more power to oxygen generation."
        if exposure >= 15:
            return "The crew got too much radiation. Power up the shelter before the storm."
        return None

    def goal_met():
        if failed():
            return False
        if mission == "oxygen":
            return round(oxygen, 1) >= 37 and cleanliness == 100
        if mission == "food":
            return sum(stored_crops.values()) >= 1
        if mission == "storm":
            return simulated_hours >= 8 and state["power"]["allocations"]["Communication"]["allocated_kw"] >= 1
        return False

    for turn in turns:
        if failed() or goal_met():
            break
        action = turn["action"]
        allocations = {**REQUIREMENTS, "Oxygen Generation": turn["oxygen"], "Artificial Lighting": turn["lighting"]}
        if mission:
            allocations["Radiation Protection"] = turn.get("shielding", 0)
        command = {}
        if action == "refill":
            inventory["water_liters"] = 10
        elif action == "clean":
            command["clean_panels"] = True
        elif action == "water":
            command["water"] = True
        elif action in ("plant", "harvest"):
            command[f"{action}_crop"] = turn["crop"]
            if action == "plant" and not any(growth.values()):
                # The model tracks one timer for all crops. A new batch starts fresh.
                plants.hours_since_last_watering = 0
                plants.watered_liters_per_plant = 0
        actions = {"refill": "Water tank refilled."} if action == "refill" else {}
        if action == "store":
            crop = turn["crop"]
            quantity = inventory["harvested_crops"].pop(crop, 0)
            if quantity:
                stored_crops[crop] = stored_crops.get(crop, 0) + quantity
                actions["store"] = f"Stored {quantity} {crop} for the crew."
            else:
                actions["store"] = "Harvest a crop before storing it."
            # Moving food into storage does not advance the clock.
            continue
        storm_seen = False
        plants_lost = False
        for hour in range(HOURS_PER_TURN):
            state = step(1, allocations, command if hour == 0 else {})
            actions.update(state["player_action_results"])
            storm_seen |= state["environment"]["solar_storm"]
            plants_lost |= bool(state["greenhouse"]["irrigation"]["plants_dead"])
            if failed():
                break
        if plants_lost:
            actions["plants"] = "Unwatered crops died. Plant new seeds to try again."

    systems = state["power"]["allocations"]
    return {
        "sol": state["clock"]["sol"],
        "hour": state["clock"]["lunar_hour"],
        "storm": state["environment"]["solar_storm"],
        "stormSeen": storm_seen,
        "goalMet": goal_met(),
        "failure": failed() or ("The training window closed. Try the mission again."
                                 if len(turns) >= MAX_TURNS and not goal_met() else None),
        "exposure": exposure,
        "shieldPower": systems["Radiation Protection"]["allocated_kw"],
        "radioPower": systems["Communication"]["allocated_kw"],
        "solarStorm": mission == "storm" and 4 <= simulated_hours < 8,
        "stormPassed": mission == "storm" and simulated_hours >= 8,
        "solar": state["power"]["solar_generated_kw"],
        "battery": state["power"]["battery"]["percentage"],
        "cleanliness": cleanliness,
        "oxygen": oxygen,
        "oxygenPower": systems["Oxygen Generation"]["allocated_kw"],
        "lightingPower": systems["Artificial Lighting"]["allocated_kw"],
        "radiation": state["life_support"]["radiation_level"],
        "temperature": temperature,
        "growth": growth,
        "water": inventory["water_liters"],
        "seeds": inventory["seeds"],
        "harvest": inventory["harvested_crops"],
        "stored": stored_crops,
        "watered": plants.watered_liters_per_plant > 0,
        "wateringDueIn": max(0, 24 - plants.hours_since_last_watering),
        "messages": list(actions.values()),
    }
