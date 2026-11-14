import random


class SandstormGenerator:

    def __init__(self, hourly_chance: float = 0.05) -> None:
        if not 0 <= hourly_chance <= 1:
            raise ValueError("hourly_chance must be between 0 and 1")
        self.hourly_chance = hourly_chance
        self._week = None
        self._storm_sols: set[int] = set()
        self._last_hour_key = None
        self._last_hour_had_storm = False

    def is_sandstorm_now(self, sol: int, lunar_hour: int) -> bool:

        if isinstance(sol, bool) or not isinstance(sol, int) or sol < 1:
            raise ValueError("sol must be a positive integer")
        if (isinstance(lunar_hour, bool) or not isinstance(lunar_hour, int)
                or not 1 <= lunar_hour <= 24):
            raise ValueError("lunar_hour must be an integer from 1 to 24")

        week = (sol - 1) // 7
        if week != self._week:
            self._week = week
            self._storm_sols.clear()
            self._last_hour_key = None
            self._last_hour_had_storm = False

        hour_key = (sol, lunar_hour)
        if hour_key == self._last_hour_key:
            return self._last_hour_had_storm

        self._last_hour_key = hour_key
        self._last_hour_had_storm = False
        if sol in self._storm_sols or len(self._storm_sols) >= 4:
            return False

        self._last_hour_had_storm = random.random() < self.hourly_chance
        if self._last_hour_had_storm:
            self._storm_sols.add(sol)
        return self._last_hour_had_storm

"""This module generate and track lunar time and date"""

SECONDS_PER_SOL = 60 * 60
class LunarGameClock:
    LUNAR_HOURS_PER_SOL = 24

    def __init__(self, sol_duration_seconds: float = SECONDS_PER_SOL) -> None:
        if sol_duration_seconds <= 0:
            raise ValueError("sol_duration_seconds must be greater than zero")
        self.sol_duration_seconds = float(sol_duration_seconds)
        self.reset()

    def reset(self) -> None:
        """Start a new mission at sol 1, lunar hour 1."""
        self.elapsed_seconds = 0.0
        self.completed_sols = 0
        self.mission_active = True

    def end_mission(self) -> None:
        """Clear the mission clock and stop time from advancing."""
        self.reset()
        self.mission_active = False

    def update(self, delta_seconds: float) -> dict[str, int | float | bool]:

        if delta_seconds < 0:
            raise ValueError("delta_seconds cannot be negative")

        if self.mission_active:
            self.elapsed_seconds += delta_seconds
            self.completed_sols = int(
                self.elapsed_seconds // self.sol_duration_seconds
            )

        elapsed_in_sol = self.elapsed_seconds % self.sol_duration_seconds
        seconds_per_hour = self.sol_duration_seconds / self.LUNAR_HOURS_PER_SOL
        lunar_hour = int(elapsed_in_sol // seconds_per_hour) + 1

        return {
            "sol": self.completed_sols + 1,
            "completed_sols": self.completed_sols,
            "lunar_hour": lunar_hour,
            "sun_position": WeatherEnvironment.sun_position(lunar_hour),
            "sol_progress": elapsed_in_sol / self.sol_duration_seconds,
            "mission_active": self.mission_active,
        }


class WeatherEnvironment:
    """Derive natural sunlight and environmental state from the lunar clock."""

    @staticmethod
    def sun_position(lunar_hour: int) -> int:
        if isinstance(lunar_hour, bool) or not isinstance(lunar_hour, int):
            raise TypeError("lunar_hour must be an integer")
        hour = lunar_hour % 24
        if 1 <= hour <= 6:
            return hour
        if 7 <= hour <= 11:
            return 12 - hour
        return 0

    @staticmethod
    def light_intensity(
        sun_position_value: int,
        is_sandstorm: bool,
        max_intensity: float = 100.0,
        sandstorm_multiplier: float = 0.3,
    ) -> float:
        if (isinstance(sun_position_value, bool)
                or not isinstance(sun_position_value, int)
                or not 0 <= sun_position_value <= 6):
            raise ValueError("sun_position_value must be an integer from 0 to 6")
        if not isinstance(is_sandstorm, bool):
            raise TypeError("is_sandstorm must be a bool")
        if max_intensity < 0:
            raise ValueError("max_intensity cannot be negative")
        if not 0 <= sandstorm_multiplier <= 1:
            raise ValueError("sandstorm_multiplier must be between 0 and 1")
        intensity = (sun_position_value / 6) * max_intensity
        return intensity * sandstorm_multiplier if is_sandstorm else intensity

    def update(self, clock_state: dict, is_sandstorm: bool) -> dict:
        """Return current sun position, sunlight, and storm status for a clock tick."""
        sun_value = self.sun_position(clock_state["lunar_hour"])
        natural_intensity = self.light_intensity(sun_value, False)
        ambient_intensity = self.light_intensity(sun_value, is_sandstorm)
        return {
            "sol": clock_state["sol"],
            "lunar_hour": clock_state["lunar_hour"],
            "sun_position": sun_value,
            "sunlight_intensity": natural_intensity,
            "ambient_light_intensity": ambient_intensity,
            "solar_storm": is_sandstorm,
        }



class LifeSupportRadiation:
    """Expose the existing oxygen-duration and radiation calculations together."""

    @staticmethod
    def calculate_oxygen_days_left(
        current_oxygen: float,
        crew_count: int,
        oxygen_generation_per_day: float | list[float],
        oxygen_use_per_person_per_day: float,
    ) -> float:
        if current_oxygen < 0:
            raise ValueError("current_oxygen cannot be negative")
        if isinstance(crew_count, bool) or not isinstance(crew_count, int) or crew_count < 0:
            raise ValueError("crew_count must be a non-negative integer")
        if oxygen_use_per_person_per_day < 0:
            raise ValueError("oxygen_use_per_person_per_day cannot be negative")

        daily_crew_use = crew_count * oxygen_use_per_person_per_day
        if daily_crew_use == 0:
            return float("inf")
        if isinstance(oxygen_generation_per_day, (int, float)):
            if oxygen_generation_per_day < 0:
                raise ValueError("oxygen_generation_per_day cannot be negative")
            net_daily_use = daily_crew_use - oxygen_generation_per_day
            if net_daily_use <= 0:
                return float("inf")
            return current_oxygen / net_daily_use

        generation_schedule = list(oxygen_generation_per_day)
        if any(amount < 0 for amount in generation_schedule):
            raise ValueError("daily oxygen generation values cannot be negative")
        oxygen = current_oxygen
        days = 0.0
        for generation in generation_schedule:
            net_daily_use = daily_crew_use - generation
            if net_daily_use <= 0:
                oxygen += -net_daily_use
                days += 1
                continue
            if oxygen < net_daily_use:
                return days + oxygen / net_daily_use
            oxygen -= net_daily_use
            days += 1
        return days + oxygen / daily_crew_use

    @staticmethod
    def calculate_radiation_level(
        lunar_hour: int,
        shielding_status: float,
        base_radiation: float = 1.0,
        peak_sun_radiation: float = 4.0,
    ) -> float:
        if (isinstance(lunar_hour, bool) or not isinstance(lunar_hour, int)
                or not 1 <= lunar_hour <= 24):
            raise ValueError("lunar_hour must be an integer from 1 to 24")
        if not 0 <= shielding_status <= 100:
            raise ValueError("shielding_status must be between 0 and 100")
        if base_radiation < 0 or peak_sun_radiation < 0:
            raise ValueError("radiation values cannot be negative")
        sun_strength = WeatherEnvironment.sun_position(lunar_hour) / 6
        unshielded_level = base_radiation + peak_sun_radiation * sun_strength
        return unshielded_level * (1 - shielding_status / 100)

    def update(self, lunar_hour: int, settings: dict) -> dict:
        """Calculate oxygen endurance and current radiation from supplied mission data."""
        return {
            "oxygen_days_left": self.calculate_oxygen_days_left(
                settings["current_oxygen"],
                settings["crew_count"],
                settings["oxygen_generation_per_day"],
                settings["oxygen_use_per_person_per_day"],
            ),
            "radiation_level": self.calculate_radiation_level(
                lunar_hour,
                settings["shielding_status"],
                settings.get("base_radiation", 1.0),
                settings.get("peak_sun_radiation", 4.0),
            ),
        }




class Plantation:
    """Manage crop planting, irrigation, growth, and harvesting."""

    def __init__(
        self,
        available_water_liters: float,
        plant_count: int,
        liters_per_plant: float = 0.2,
        hours_since_last_watering: float = 0.0,
    ) -> None:
        if available_water_liters < 0 or liters_per_plant < 0:
            raise ValueError("water quantities cannot be negative")
        if isinstance(plant_count, bool) or not isinstance(plant_count, int) or plant_count < 0:
            raise ValueError("plant_count must be a non-negative integer")
        if hours_since_last_watering < 0:
            raise ValueError("hours_since_last_watering cannot be negative")
        self.available_water_liters = available_water_liters
        self.plant_count = plant_count
        self.liters_per_plant = liters_per_plant
        self.hours_since_last_watering = hours_since_last_watering
        self.watered_liters_per_plant = 0.0

    def update_irrigation(self, player_command: str, elapsed_hours: float) -> dict:
        """Track watering age and water inventory across simulation ticks."""
        if elapsed_hours < 0:
            raise ValueError("elapsed_hours cannot be negative")
        self.hours_since_last_watering += elapsed_hours
        result = self.irrigate_plants(
            player_command,
            self.available_water_liters,
            self.plant_count,
            self.hours_since_last_watering,
            self.liters_per_plant,
        )
        self.available_water_liters = result["remaining_water_liters"]
        if result["watered"]:
            self.hours_since_last_watering = 0.0
            self.watered_liters_per_plant = self.liters_per_plant
        elif result["plants_dead"]:
            self.watered_liters_per_plant = 0.0
        result["hours_since_last_watering"] = self.hours_since_last_watering
        return result

    @staticmethod
    def add_crop(
        player_command: str,
        crop_type: str,
        seeds_available: dict[str, int],
        greenhouse_growth: dict[str, list[float]],
        available_space: int,
        quantity: int = 1,
    ) -> dict[str, int | dict[str, int] | dict[str, list[float]] | str | bool]:
        """Plant a requested quantity of one crop if seeds and greenhouse space allow.

        Each planted seed uses one greenhouse space and starts at 0% growth.
        """
        if not isinstance(player_command, str):
            raise TypeError("player_command must be a string")
        if not isinstance(crop_type, str) or not crop_type.strip():
            raise ValueError("crop_type must be a non-empty string")
        if not isinstance(seeds_available, dict) or not isinstance(greenhouse_growth, dict):
            raise TypeError("seeds_available and greenhouse_growth must be dictionaries")
        if isinstance(available_space, bool) or not isinstance(available_space, int) or available_space < 0:
            raise ValueError("available_space must be a non-negative integer")
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
            raise ValueError("quantity must be a positive integer")
        if any(not isinstance(name, str) or isinstance(count, bool)
               or not isinstance(count, int) or count < 0
               for name, count in seeds_available.items()):
            raise ValueError("seeds_available must map crop names to non-negative integers")
        if any(not isinstance(name, str) or not isinstance(growth, list)
               or any(isinstance(value, bool) or not isinstance(value, (int, float))
                      or not 0 <= value <= 100 for value in growth)
               for name, growth in greenhouse_growth.items()):
            raise ValueError("greenhouse_growth must map crop names to growth percentage lists")

        crop_name = crop_type.strip().lower()
        seeds = {name.lower(): count for name, count in seeds_available.items()}
        greenhouse = {name.lower(): list(growth) for name, growth in greenhouse_growth.items()}

        result = {
            "planted": False,
            "crop_type": crop_name,
            "quantity_planted": 0,
            "seeds_remaining": seeds,
            "greenhouse_growth": greenhouse,
            "remaining_space": available_space,
            "message": "",
        }
        if player_command.strip().lower() != "plant":
            result["message"] = "Enter 'plant' to add seeds to the greenhouse."
            return result

        actual_space = available_space
        if seeds.get(crop_name, 0) < quantity:
            result["message"] = (
                f"Not enough {crop_name} seeds. Need {quantity}; "
                f"inventory has {seeds.get(crop_name, 0)}."
            )
            result["remaining_space"] = actual_space
            return result
        if actual_space < quantity:
            result["message"] = (
                f"Not enough greenhouse space. Need {quantity}; "
                f"only {actual_space} spaces are available."
            )
            result["remaining_space"] = actual_space
            return result

        seeds[crop_name] -= quantity
        greenhouse.setdefault(crop_name, []).extend([0.0] * quantity)
        result.update({
            "planted": True,
            "quantity_planted": quantity,
            "seeds_remaining": seeds,
            "greenhouse_growth": greenhouse,
            "remaining_space": actual_space - quantity,
            "message": f"Planted {quantity} {crop_name} seed(s) in the greenhouse.",
        })
        return result

    @staticmethod
    def irrigate_plants(
        player_command: str,
        available_water_liters: float,
        plant_count: int,
        hours_since_last_watering: float,
        liters_per_plant: float = 0.2,
    ) -> dict[str, float | int | bool | str]:
        if not isinstance(player_command, str):
            raise TypeError("player_command must be a string")
        if available_water_liters < 0:
            raise ValueError("available_water_liters cannot be negative")
        if isinstance(plant_count, bool) or not isinstance(plant_count, int) or plant_count < 0:
            raise ValueError("plant_count must be a non-negative integer")
        if hours_since_last_watering < 0:
            raise ValueError("hours_since_last_watering cannot be negative")
        if liters_per_plant < 0:
            raise ValueError("liters_per_plant cannot be negative")

        if hours_since_last_watering >= 24:
            return {
                "water_used_liters": 0.0,
                "remaining_water_liters": available_water_liters,
                "plants_watered": 0,
                "plants_alive": 0,
                "plants_dead": plant_count,
                "reminder": False,
                "watered": False,
                "message": "The plants went without water for 24 hours and have died.",
            }

        reminder = hours_since_last_watering >= 22
        if player_command.strip().lower() != "water":
            message = (
                "Reminder: plants are thirsty. Use the 'water' command ASAP!"
                if reminder else "No watering command received."
            )
            return {
                "water_used_liters": 0.0,
                "remaining_water_liters": available_water_liters,
                "plants_watered": 0,
                "plants_alive": plant_count,
                "plants_dead": 0,
                "reminder": reminder,
                "watered": False,
                "message": message,
            }

        water_needed = plant_count * liters_per_plant
        if available_water_liters < water_needed:
            return {
                "water_used_liters": 0.0,
                "remaining_water_liters": available_water_liters,
                "plants_watered": 0,
                "plants_alive": plant_count,
                "plants_dead": 0,
                "reminder": reminder,
                "watered": False,
                "message": (
                    f"Not enough water. Need {water_needed:.1f} L for "
                    f"{plant_count} plants; inventory has {available_water_liters:.1f} L."
                ),
            }

        remaining = available_water_liters - water_needed
        return {
            "water_used_liters": water_needed,
            "remaining_water_liters": remaining,
            "plants_watered": plant_count,
            "plants_alive": plant_count,
            "plants_dead": 0,
            "reminder": reminder,
            "watered": True,
            "message": (
                f"Watered {plant_count} plants with {water_needed:.1f} L. "
                f"{remaining:.1f} L of water remaining."
            ),
        }

    @staticmethod
    def harvest_crops(
        player_command: str,
        crop_type: str,
        plant_growth_percentages: list[float],
        collected_crops: dict[str, int] | None = None,
    ) -> dict[str, int | list[float] | str | bool]:
        if not isinstance(player_command, str):
            raise TypeError("player_command must be a string")
        if not isinstance(crop_type, str) or not crop_type.strip():
            raise ValueError("crop_type must be a non-empty string")
        if not isinstance(plant_growth_percentages, list):
            raise TypeError("plant_growth_percentages must be a list")
        if any(isinstance(growth, bool) or not isinstance(growth, (int, float))
               or not 0 <= growth <= 100 for growth in plant_growth_percentages):
            raise ValueError("each plant growth percentage must be between 0 and 100")
        if collected_crops is None:
            collected_crops = {}
        if not isinstance(collected_crops, dict):
            raise TypeError("collected_crops must be a dictionary")
        if any(not isinstance(name, str) or isinstance(quantity, bool)
               or not isinstance(quantity, int) or quantity < 0
               for name, quantity in collected_crops.items()):
            raise ValueError("collected_crops must map crop names to non-negative integers")

        crop_name = crop_type.strip().lower()
        grown_count = sum(growth >= 100 for growth in plant_growth_percentages)
        if player_command.strip().lower() != "harvest":
            return {
                "harvested": False,
                "crop_type": crop_name,
                "quantity_harvested": 0,
                "remaining_plant_growth": plant_growth_percentages.copy(),
                "collected_crops": collected_crops.copy(),
                "message": "Enter 'harvest' to collect fully grown crops.",
            }

        remaining_growth = [growth for growth in plant_growth_percentages if growth < 100]
        updated_inventory = collected_crops.copy()
        updated_inventory[crop_name] = updated_inventory.get(crop_name, 0) + grown_count
        message = (
            f"Harvested {grown_count} {crop_name}(s)."
            if grown_count else f"No fully grown {crop_name} plants are ready to harvest."
        )
        return {
            "harvested": grown_count > 0,
            "crop_type": crop_name,
            "quantity_harvested": grown_count,
            "remaining_plant_growth": remaining_growth,
            "collected_crops": updated_inventory,
            "message": message,
        }

    @staticmethod
    def update_growth(
        greenhouse_growth: dict[str, list[float]],
        elapsed_sols: int,
        light_intensity: float,
        water_given_per_crop: dict[str, float],
    ) -> dict[str, list[float]]:
        """Advance every living plant once per completed sol using the existing growth formula."""
        if isinstance(elapsed_sols, bool) or not isinstance(elapsed_sols, int) or elapsed_sols < 0:
            raise ValueError("elapsed_sols must be a non-negative integer")
        updated = {crop: list(growth_values) for crop, growth_values in greenhouse_growth.items()}
        for crop, growth_values in updated.items():
            water = water_given_per_crop.get(crop, 0.0)
            for _ in range(elapsed_sols):
                for index, growth in enumerate(growth_values):
                    growth_values[index] = Plantation.calculate_plant_growth(
                        crop, light_intensity, water, growth
                    )
        return updated

    @staticmethod
    def calculate_plant_growth(
        plant_type: str,
        light_intensity: float,
        water_given: float,
        current_growth: float = 0.0,
    ) -> float:
        """Calculate one day's plant growth with the original crop requirements."""
        plant_requirements = {
            "lettuce": (70.0, 0.5),
            "potato": (60.0, 0.6),
            "tomato": (85.0, 0.8),
        }
        if not isinstance(plant_type, str) or plant_type.lower() not in plant_requirements:
            raise ValueError("plant_type must be lettuce, potato, or tomato")
        if not 0 <= light_intensity <= 100:
            raise ValueError("light_intensity must be between 0 and 100")
        if water_given < 0:
            raise ValueError("water_given cannot be negative")
        if not 0 <= current_growth <= 100:
            raise ValueError("current_growth must be between 0 and 100")

        optimal_light, optimal_water = plant_requirements[plant_type.lower()]
        light_factor = min(light_intensity / optimal_light, 1.0)
        water_ratio = water_given / optimal_water
        water_factor = min(water_ratio, max(0.0, 2.0 - water_ratio))
        daily_growth = 10.0 * light_factor * water_factor
        return round(min(100.0, current_growth + daily_growth), 2)


plantation = Plantation  # Compatibility alias for existing callers.


# greenhouse = {
#     "lettuce": [100, 75, 100],
#     "tomato": [100, 100, 60],
#     "potato": [80, 100],
# }
# collected = {"lettuce": 3, "tomato": 1}

# for crop_type, growth in greenhouse.items():
#     result = harvest_crops("harvest", crop_type, growth, collected)
#     greenhouse[crop_type] = result["remaining_plant_growth"]
#     collected = result["collected_crops"]
#     print(result["message"])

"""Basic, manually configured lunar base energy management example."""

class PowerGeneration:
    """Generate solar power, apply player allocations, and manage battery energy."""

    SYSTEM_NAMES = (
        "Oxygen Generation",
        "Life Support",
        "Scientific Research Laboratory",
        "Artificial Lighting",
        "Heating System",
        "Radiation Protection",
        "Communication",
    )

    def __init__(
        self,
        battery_capacity_kwh: float,
        battery_charge_kwh: float,
        charging_efficiency: float,
        discharging_efficiency: float,
        max_charging_power_kw: float,
        max_discharging_power_kw: float,
        solar_max_power_watts: float = 100_000.0,
    ) -> None:
        if battery_capacity_kwh <= 0:
            raise ValueError("battery_capacity_kwh must be greater than zero")
        if not 0 <= battery_charge_kwh <= battery_capacity_kwh:
            raise ValueError("battery charge must be between zero and battery capacity")
        if not 0 < charging_efficiency <= 1 or not 0 < discharging_efficiency <= 1:
            raise ValueError("battery efficiencies must be greater than zero and at most one")
        if max_charging_power_kw < 0 or max_discharging_power_kw < 0:
            raise ValueError("maximum battery power cannot be negative")
        if solar_max_power_watts < 0:
            raise ValueError("solar_max_power_watts cannot be negative")

        self.battery_capacity_kwh = battery_capacity_kwh
        self.battery_charge_kwh = battery_charge_kwh
        self.charging_efficiency = charging_efficiency
        self.discharging_efficiency = discharging_efficiency
        self.max_charging_power_kw = max_charging_power_kw
        self.max_discharging_power_kw = max_discharging_power_kw
        self.solar_max_power_watts = solar_max_power_watts

    def calculate_solar_power(
        self,
        intensity: float,
        is_sandstorm: bool,
        sun_position_value: int,
        panel_cleanliness: float,
        sandstorm_multiplier: float = 0.3,
    ) -> float:
        """Apply the original solar formula and return generated power in kW."""
        if not 0 <= intensity <= 100:
            raise ValueError("intensity must be between 0 and 100")
        if (isinstance(sun_position_value, bool)
                or not isinstance(sun_position_value, int)
                or not 0 <= sun_position_value <= 6):
            raise ValueError("sun_position_value must be an integer from 0 to 6")
        if not 0 <= panel_cleanliness <= 100:
            raise ValueError("panel_cleanliness must be between 0 and 100")
        if not isinstance(is_sandstorm, bool):
            raise TypeError("is_sandstorm must be a bool")
        if not 0 <= sandstorm_multiplier <= 1:
            raise ValueError("sandstorm_multiplier must be between 0 and 1")

        generated_watts = (
            self.solar_max_power_watts
            * (intensity / 100)
            * (sun_position_value / 6)
            * (panel_cleanliness / 100)
        )
        if is_sandstorm:
            generated_watts *= sandstorm_multiplier
        return generated_watts / 1000.0

    @staticmethod
    def clean_solar_panel(
        player_command: str,
        current_cleanliness: float,
    ) -> dict[str, float | bool | str]:
        """Apply the player's clean command to solar panel cleanliness."""
        if not isinstance(player_command, str):
            raise TypeError("player_command must be a string")
        if not 0 <= current_cleanliness <= 100:
            raise ValueError("current_cleanliness must be between 0 and 100")
        if player_command.strip().lower() != "clean":
            return {
                "cleanliness": current_cleanliness,
                "cleaned": False,
                "message": "Enter 'clean' to clean the solar panel.",
            }
        if current_cleanliness == 100:
            return {
                "cleanliness": 100.0,
                "cleaned": False,
                "message": "The solar panel is already clean.",
            }
        return {
            "cleanliness": 100.0,
            "cleaned": True,
            "message": f"Solar panel cleaned: {current_cleanliness:.1f}% -> 100.0%.",
        }

    def allocate_resources(
        self,
        available_power_kw: float,
        system_requirements_kw: dict[str, float],
        requested_allocations_kw: dict[str, float],
    ) -> dict:
        """Allocate player-selected power and report any gap from system requirements."""
        if available_power_kw < 0:
            raise ValueError("available_power_kw cannot be negative")
        for label, values in (
            ("system_requirements_kw", system_requirements_kw),
            ("requested_allocations_kw", requested_allocations_kw),
        ):
            if not isinstance(values, dict):
                raise TypeError(f"{label} must be a dictionary")
            missing = set(self.SYSTEM_NAMES) - set(values)
            unknown = set(values) - set(self.SYSTEM_NAMES)
            if missing or unknown:
                raise ValueError(
                    f"{label} keys must match system names; missing={missing}, unknown={unknown}"
                )
            for name, value in values.items():
                if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
                    raise ValueError(f"{label} value for {name} must be non-negative")

        total_demand_kw = sum(system_requirements_kw.values())
        selected_kw = {
            name: min(float(requested_allocations_kw[name]), float(system_requirements_kw[name]))
            for name in self.SYSTEM_NAMES
        }
        total_selected_kw = sum(selected_kw.values())
        factor = min(1.0, available_power_kw / total_selected_kw) if total_selected_kw else 1.0
        allocations = {}
        for name in self.SYSTEM_NAMES:
            required_kw = float(system_requirements_kw[name])
            selected_for_system_kw = selected_kw[name]
            allocated_kw = selected_for_system_kw * factor
            shortage_kw = max(0.0, required_kw - allocated_kw)
            allocations[name] = {
                "name": name,
                "required_kw": required_kw,
                "selected_kw": selected_for_system_kw,
                "allocated_kw": allocated_kw,
                "shortage_kw": shortage_kw,
                "status": "ON" if allocated_kw > 0 else "OFF",
            }

        total_allocated_kw = sum(item["allocated_kw"] for item in allocations.values())
        return {
            "systems": allocations,
            "total_demand_kw": total_demand_kw,
            "total_selected_kw": total_selected_kw,
            "total_allocated_kw": total_allocated_kw,
            "remaining_power_kw": max(0.0, available_power_kw - total_allocated_kw),
            "allocation_shortage_kw": max(0.0, total_selected_kw - total_allocated_kw),
            "energy_shortage_kw": max(0.0, total_demand_kw - total_allocated_kw),
        }

    def manage_battery(
        self,
        power_kw: float,
        elapsed_hours: float,
        mode: str,
    ) -> dict:
        """Charge from surplus or supply a requested load, respecting kW and kWh limits."""
        if power_kw < 0 or elapsed_hours < 0:
            raise ValueError("power_kw and elapsed_hours cannot be negative")
        if mode not in ("charge", "discharge", "idle"):
            raise ValueError("mode must be 'charge', 'discharge', or 'idle'")

        charge_before_kwh = self.battery_charge_kwh
        actual_power_kw = 0.0
        if elapsed_hours > 0 and mode == "charge":
            input_room_kw = (
                self.battery_capacity_kwh - self.battery_charge_kwh
            ) / (elapsed_hours * self.charging_efficiency)
            actual_power_kw = min(power_kw, self.max_charging_power_kw, input_room_kw)
            self.battery_charge_kwh += (
                actual_power_kw * elapsed_hours * self.charging_efficiency
            )
        elif elapsed_hours > 0 and mode == "discharge":
            available_output_kw = (
                self.battery_charge_kwh * self.discharging_efficiency / elapsed_hours
            )
            actual_power_kw = min(
                power_kw, self.max_discharging_power_kw, available_output_kw
            )
            self.battery_charge_kwh -= (
                actual_power_kw * elapsed_hours / self.discharging_efficiency
            )

        self.battery_charge_kwh = min(
            self.battery_capacity_kwh, max(0.0, self.battery_charge_kwh)
        )
        return {
            "charge_before_kwh": charge_before_kwh,
            "charge_after_kwh": self.battery_charge_kwh,
            "percentage": 100 * self.battery_charge_kwh / self.battery_capacity_kwh,
            "state": mode if actual_power_kw > 0 else "idle",
            "power_kw": actual_power_kw,
        }

    @staticmethod
    def artificial_lighting_intensity(
        allocated_kw: float,
        maximum_lighting_kw: float,
        maximum_intensity: float = 100.0,
    ) -> float:
        """Convert player-allocated lighting power to a configurable light contribution."""
        if allocated_kw < 0 or maximum_lighting_kw < 0:
            raise ValueError("lighting power values cannot be negative")
        if not 0 <= maximum_intensity <= 100:
            raise ValueError("maximum_intensity must be between 0 and 100")
        if maximum_lighting_kw == 0:
            return 0.0
        return min(maximum_intensity, allocated_kw / maximum_lighting_kw * maximum_intensity)

    @staticmethod
    def heating_is_active(allocated_kw: float, minimum_operating_kw: float = 0.0) -> bool:
        """Report whether the user's heating allocation reaches its configured operating level."""
        if allocated_kw < 0 or minimum_operating_kw < 0:
            raise ValueError("heating power values cannot be negative")
        return allocated_kw > 0 and allocated_kw >= minimum_operating_kw

    @staticmethod
    def update_greenhouse_temperature(
        current_temperature_c: float,
        heating_power_kw: float,
        elapsed_hours: float,
        heating_rise_c_per_kwh: float,
        cooling_c_per_hour: float,
    ) -> float:
        """Update temperature from explicitly configured simulation rates."""
        if heating_power_kw < 0 or elapsed_hours < 0:
            raise ValueError("heating power and elapsed hours cannot be negative")
        if heating_rise_c_per_kwh < 0 or cooling_c_per_hour < 0:
            raise ValueError("temperature rates cannot be negative")
        temperature_change = (
            heating_power_kw * heating_rise_c_per_kwh - cooling_c_per_hour
        ) * elapsed_hours
        return current_temperature_c + temperature_change


LunarEnergyManager = PowerGeneration  # Compatibility alias for existing callers.


def update_energy_system(
    manager: LunarEnergyManager,
    environment: dict,
    elapsed_hours: float,
    system_requirements_kw: dict[str, float],
    requested_allocations_kw: dict[str, float],
    print_results: bool = True,
) -> dict:
    """Calculate solar, honor player allocations, respond with the battery, and print results."""
    solar_kw = manager.calculate_solar_power(
        environment["sunlight_intensity"],
        environment["solar_storm"],
        environment["sun_position"],
        environment["panel_cleanliness"],
    )

    # Allocate solar first, then use the battery only for the unserved demand.
    allocation = manager.allocate_resources(
        solar_kw, system_requirements_kw, requested_allocations_kw
    )
    battery = manager.manage_battery(
        allocation["allocation_shortage_kw"], elapsed_hours, "discharge"
    )
    if battery["power_kw"] > 0:
        allocation = manager.allocate_resources(
            solar_kw + battery["power_kw"],
            system_requirements_kw,
            requested_allocations_kw,
        )

    # Any solar not allocated to equipment is stored, subject to battery limits.
    if allocation["remaining_power_kw"] > 0:
        battery = manager.manage_battery(
            allocation["remaining_power_kw"], elapsed_hours, "charge"
        )

    results = {
        "solar_generated_kw": solar_kw,
        "total_power_demand_kw": allocation["total_demand_kw"],
        "allocations": allocation["systems"],
        "total_power_consumed_kw": allocation["total_allocated_kw"],
        "remaining_power_kw": allocation["remaining_power_kw"],
        "battery": battery,
        "energy_shortage_kw": allocation["energy_shortage_kw"],
    }

    if print_results:
        print(f"Solar generated: {solar_kw:.2f} kW")
        print(f"Total power demand: {results['total_power_demand_kw']:.2f} kW")
        print("Power allocation:")
        for name, system in results["allocations"].items():
            print(
                f"  {name}: {system['allocated_kw']:.2f} kW / "
                f"{system['required_kw']:.2f} kW required "
                f"({system['status']}; shortage {system['shortage_kw']:.2f} kW)"
            )
        print(f"Total power consumed: {results['total_power_consumed_kw']:.2f} kW")
        print(
            f"Battery charge: {battery['charge_before_kwh']:.2f} -> "
            f"{battery['charge_after_kwh']:.2f} kWh ({battery['state']})"
        )
        print(f"Energy shortage: {results['energy_shortage_kw']:.2f} kW")
    return results


def update_lunar_mission(
    delta_seconds: float,
    game_clock: LunarGameClock,
    weather: WeatherEnvironment,
    sandstorms: SandstormGenerator,
    power_generation: PowerGeneration,
    system_requirements_kw: dict[str, float],
    player_allocations_kw: dict[str, float],
    panel_cleanliness: float,
    plantation_system: Plantation,
    player_water_command: str,
    greenhouse_growth: dict[str, list[float]],
    life_support_settings: dict,
    maximum_lighting_kw: float,
    greenhouse_temperature_c: float,
    heating_settings: dict[str, float],
    minimum_heating_kw: float = 0.0,
    player_actions: dict | None = None,
    inventory: dict | None = None,
) -> dict:
    """Advance the mission using player actions and return updated simulation state.

    ``player_actions`` may contain ``clean_panels`` (bool), ``water`` (bool),
    ``power_allocations_kw`` (system-to-kW mapping), ``harvest_crop`` (crop name),
    ``plant_crop`` (crop name), and ``plant_quantity`` (positive integer).
    ``inventory`` may contain ``seeds`` and ``harvested_crops`` mappings and an
    integer ``greenhouse_capacity``. Returned inventory should be passed into the
    next call so player decisions and stock persist between simulation ticks.
    """
    if delta_seconds < 0:
        raise ValueError("delta_seconds cannot be negative")

    actions = player_actions or {}
    updated_inventory = {
        "seeds": dict((inventory or {}).get("seeds", {})),
        "harvested_crops": dict((inventory or {}).get("harvested_crops", {})),
        "greenhouse_capacity": (inventory or {}).get("greenhouse_capacity", 0),
        "water_liters": (inventory or {}).get(
            "water_liters", plantation_system.available_water_liters
        ),
    }
    plantation_system.available_water_liters = updated_inventory["water_liters"]
    action_results = {}
    if "power_allocations_kw" in actions:
        player_allocations_kw = actions["power_allocations_kw"]
    if actions.get("clean_panels", False):
        cleaning = power_generation.clean_solar_panel("clean", panel_cleanliness)
        panel_cleanliness = cleaning["cleanliness"]
        action_results["clean_panels"] = cleaning["message"]

    # Apply crop decisions before this tick's irrigation and growth update.
    if actions.get("harvest_crop"):
        crop_name = str(actions["harvest_crop"]).strip().lower()
        harvest = Plantation.harvest_crops(
            "harvest",
            crop_name,
            greenhouse_growth.get(crop_name, []),
            updated_inventory["harvested_crops"],
        )
        greenhouse_growth = dict(greenhouse_growth)
        greenhouse_growth[crop_name] = harvest["remaining_plant_growth"]
        updated_inventory["harvested_crops"] = harvest["collected_crops"]
        action_results["harvest"] = harvest["message"]
    if actions.get("plant_crop"):
        crop_name = str(actions["plant_crop"]).strip().lower()
        capacity = updated_inventory["greenhouse_capacity"]
        if isinstance(capacity, bool) or not isinstance(capacity, int) or capacity < 0:
            raise ValueError("inventory.greenhouse_capacity must be a non-negative integer")
        occupied = sum(len(plants) for plants in greenhouse_growth.values())
        planting = Plantation.add_crop(
            "plant",
            crop_name,
            updated_inventory["seeds"],
            greenhouse_growth,
            max(0, capacity - occupied),
            actions.get("plant_quantity", 1),
        )
        greenhouse_growth = planting["greenhouse_growth"]
        updated_inventory["seeds"] = planting["seeds_remaining"]
        action_results["plant"] = planting["message"]

    # Irrigation applies to all plants currently growing after harvest/planting.
    plantation_system.plant_count = sum(len(plants) for plants in greenhouse_growth.values())
    water_command = "water" if actions.get("water", False) else player_water_command

    previous_completed_sols = game_clock.completed_sols
    clock_state = game_clock.update(delta_seconds)
    elapsed_sols = game_clock.completed_sols - previous_completed_sols
    elapsed_hours = (
        delta_seconds * game_clock.LUNAR_HOURS_PER_SOL / game_clock.sol_duration_seconds
        if clock_state["mission_active"] else 0.0
    )

    storm = sandstorms.is_sandstorm_now(
        clock_state["sol"], clock_state["lunar_hour"]
    )
    environment_state = weather.update(clock_state, storm)
    environment_state["panel_cleanliness"] = panel_cleanliness
    power_state = update_energy_system(
        power_generation,
        environment_state,
        elapsed_hours,
        system_requirements_kw,
        player_allocations_kw,
        print_results=False,
    )

    irrigation_state = plantation_system.update_irrigation(
        water_command, elapsed_hours
    )
    if actions.get("water", False) or player_water_command.strip().lower() == "water":
        action_results["water"] = irrigation_state["message"]
    updated_inventory["water_liters"] = plantation_system.available_water_liters

    actual_lighting_kw = power_state["allocations"]["Artificial Lighting"]["allocated_kw"]
    artificial_light = power_generation.artificial_lighting_intensity(
        actual_lighting_kw, maximum_lighting_kw
    )
    plant_light_intensity = min(
        100.0, environment_state["ambient_light_intensity"] + artificial_light
    )
    actual_heating_kw = power_state["allocations"]["Heating System"]["allocated_kw"]
    heating_active = power_generation.heating_is_active(
        actual_heating_kw, minimum_heating_kw
    )
    updated_temperature_c = power_generation.update_greenhouse_temperature(
        greenhouse_temperature_c,
        actual_heating_kw if heating_active else 0.0,
        elapsed_hours,
        heating_settings["temperature_rise_c_per_kwh"],
        heating_settings["cooling_c_per_hour"],
    )

    if irrigation_state["plants_dead"]:
        updated_greenhouse = {crop: [] for crop in greenhouse_growth}
    else:
        water_given_per_crop = {
            crop: plantation_system.watered_liters_per_plant
            for crop in greenhouse_growth
        }
        updated_greenhouse = Plantation.update_growth(
            greenhouse_growth,
            elapsed_sols,
            plant_light_intensity,
            water_given_per_crop,
        )

    life_support_inputs = dict(life_support_settings)
    oxygen_power_kw = power_state["allocations"]["Oxygen Generation"]["allocated_kw"]
    life_support_inputs["oxygen_generation_per_day"] = (
        oxygen_power_kw
        * life_support_settings["oxygen_generation_per_kw_per_day"]
    )
    life_support_state = LifeSupportRadiation().update(
        clock_state["lunar_hour"], life_support_inputs
    )

    return {
        "clock": clock_state,
        "environment": environment_state,
        "power": power_state,
        "greenhouse": {
            "growth": updated_greenhouse,
            "light_intensity": plant_light_intensity,
            "heating_active": heating_active,
            "temperature_c": updated_temperature_c,
            "irrigation": irrigation_state,
        },
        "life_support": life_support_state,
        "inventory": updated_inventory,
        "player_action_results": action_results,
    }


if __name__ == "__main__":
    # Player-editable simulation settings; values are examples, not technical specifications.
    system_requirements_kw = {
        "Oxygen Generation": 6.0,
        "Life Support": 8.0,
        "Scientific Research Laboratory": 5.0,
        "Artificial Lighting": 4.0,
        "Heating System": 5.0,
        "Radiation Protection": 5.0,
        "Communication": 2.0,
    }
    player_allocations_kw = {
        "Oxygen Generation": 6.0,
        "Life Support": 8.0,
        "Scientific Research Laboratory": 5.0,
        "Artificial Lighting": 1.0,
        "Heating System": 5.0,
        "Radiation Protection": 5.0,
        "Communication": 2.0,
    }
    battery_settings = {
        "capacity_kwh": 120.0,
        "charge_kwh": 60.0,
        "charging_efficiency": 0.90,
        "discharging_efficiency": 0.90,
        "max_charging_power_kw": 20.0,
        "max_discharging_power_kw": 20.0,
    }
    simulation = {
        # 150 seconds advances one lunar hour with the current 3600-second sol.
        "delta_seconds": 150.0,
        "panel_cleanliness": 75.0,
        "player_actions": {
            # Schedule decisions by simulation hour (0-23). Edit before running.
            0: {"clean_panels": True, "water": True},
            # Examples: {5: {"harvest_crop": "lettuce"}},
            #           {8: {"plant_crop": "tomato", "plant_quantity": 2}},
        },
        "inventory": {
            "seeds": {"lettuce": 5, "tomato": 3},
            "harvested_crops": {},
            "greenhouse_capacity": 8,
            "water_liters": 10.0,
        },
        "greenhouse_growth": {"lettuce": [25.0], "tomato": [10.0]},
        "life_support": {
            "current_oxygen": 100.0,
            "crew_count": 2,
            # Configure this conversion for the simulation's chosen oxygen units.
            "oxygen_generation_per_kw_per_day": 1.0,
            "oxygen_use_per_person_per_day": 10.0,
            "shielding_status": 50.0,
        },
        "maximum_lighting_kw": 4.0,
        "minimum_heating_kw": 1.0,
        "greenhouse_temperature_c": 20.0,
        # Illustrative rates only; edit them to match your chosen simulation model.
        "heating_settings": {
            "temperature_rise_c_per_kwh": 0.1,
            "cooling_c_per_hour": 0.0,
        },
    }

    clock = LunarGameClock()
    environment = WeatherEnvironment()
    sandstorm_generator = SandstormGenerator(hourly_chance=0.05)
    power_system = PowerGeneration(
        battery_capacity_kwh=battery_settings["capacity_kwh"],
        battery_charge_kwh=battery_settings["charge_kwh"],
        charging_efficiency=battery_settings["charging_efficiency"],
        discharging_efficiency=battery_settings["discharging_efficiency"],
        max_charging_power_kw=battery_settings["max_charging_power_kw"],
        max_discharging_power_kw=battery_settings["max_discharging_power_kw"],
        solar_max_power_watts=100_000.0,
    )

    plantation_system = Plantation(
        available_water_liters=10.0,
        plant_count=2,
        liters_per_plant=0.5,
        hours_since_last_watering=0.0,
    )
    player_water_command = ""

    mission_state = None
    # Advance one lunar sol in hourly steps so changing sunlight is reflected in energy.
    action_schedule = simulation["player_actions"]
    for hour_index in range(LunarGameClock.LUNAR_HOURS_PER_SOL):
        # Actions are code-configured by hour; power allocations persist unless overridden.
        current_player_actions = {
            "power_allocations_kw": player_allocations_kw,
            **action_schedule.get(hour_index, {}),
        }
        mission_state = update_lunar_mission(
            delta_seconds=simulation["delta_seconds"],
            game_clock=clock,
            weather=environment,
            sandstorms=sandstorm_generator,
            power_generation=power_system,
            system_requirements_kw=system_requirements_kw,
            player_allocations_kw=player_allocations_kw,
            panel_cleanliness=simulation["panel_cleanliness"],
            plantation_system=plantation_system,
            player_water_command=player_water_command,
            greenhouse_growth=simulation["greenhouse_growth"],
            life_support_settings=simulation["life_support"],
            maximum_lighting_kw=simulation["maximum_lighting_kw"],
            greenhouse_temperature_c=simulation["greenhouse_temperature_c"],
            heating_settings=simulation["heating_settings"],
            minimum_heating_kw=simulation["minimum_heating_kw"],
            player_actions=current_player_actions,
            inventory=simulation["inventory"],
        )
        simulation["greenhouse_growth"] = mission_state["greenhouse"]["growth"]
        simulation["greenhouse_temperature_c"] = mission_state["greenhouse"]["temperature_c"]
        simulation["panel_cleanliness"] = mission_state["environment"]["panel_cleanliness"]
        simulation["inventory"] = mission_state["inventory"]
        # The next loop iteration loads that hour's scheduled actions.
        player_water_command = ""

    print("Water inventory:", plantation_system.available_water_liters, "L")
    print("Player inventory:", mission_state["inventory"])
    print("Last player actions:", mission_state["player_action_results"])
    print("Final clock:", mission_state["clock"])
    print("Final environment:", mission_state["environment"])
    print("Final power state:", mission_state["power"])
    print("Final greenhouse:", mission_state["greenhouse"])
    print("Life support and radiation:", mission_state["life_support"])
