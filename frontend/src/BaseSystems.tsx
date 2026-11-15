import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { BuildingId } from './components/moonWorld';
import './base-systems.css';

const crops = ['lettuce', 'tomato'] as const;
export type TrainingMission = 'oxygen' | 'food' | 'storm';

export const trainingMissions = ['oxygen', 'food', 'storm'] as const;

function runKey(astronaut: string, mission?: TrainingMission) {
  return `luna-base-v1-${astronaut}${mission ? `-${mission}` : ''}`;
}

export function clearTrainingRuns(astronaut: string) {
  try {
    for (const mission of trainingMissions) sessionStorage.removeItem(runKey(astronaut, mission));
  } catch { /* Training can run without browser storage. */ }
}

const training = {
  oxygen: { title: 'Bring the air back', goal: 'Clean the panels. Reach 37% oxygen.' },
  food: { title: 'Grow dinner', goal: 'Fill the crew’s food box.' },
  storm: { title: 'Ride out the solar storm', goal: 'Shield the crew. Radio Earth.' },
};
type Crop = typeof crops[number];
type Action = 'wait' | 'clean' | 'water' | 'refill' | 'plant' | 'harvest' | 'store';
type Turn = { action: Action; oxygen: number; lighting: number; shielding: number; crop: Crop };
type State = {
  goalMet: boolean;
  failure: string | null;
  exposure: number;
  shieldPower: number;
  radioPower: number;
  solarStorm: boolean;
  stormPassed: boolean;
  sol: number;
  hour: number;
  storm: boolean;
  stormSeen: boolean;
  solar: number;
  battery: number;
  cleanliness: number;
  oxygen: number;
  oxygenPower: number;
  lightingPower: number;
  radiation: number;
  temperature: number;
  growth: Partial<Record<Crop, number[]>>;
  water: number;
  seeds: Record<Crop, number>;
  harvest: Partial<Record<Crop, number>>;
  stored: Partial<Record<Crop, number>>;
  watered: boolean;
  wateringDueIn: number;
  messages: string[];
};
type Save = { seed: number; turns: Turn[] };

function newRun(): Save {
  return { seed: crypto.getRandomValues(new Uint32Array(1))[0], turns: [] };
}

function loadRun(key: string): Save {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (Number.isInteger(saved?.seed) && Array.isArray(saved.turns)) return saved;
  } catch { /* The activity still works without browser storage. */ }
  return newRun();
}

const oneDecimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

async function readSimulation(save: Save, mission: TrainingMission | undefined, signal: AbortSignal): Promise<State> {
  const response = await fetch('/api/base-simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...save, mission }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  if (!response.ok) throw new Error('Base systems request failed');
  return response.json();
}

export function BaseReadings({ astronaut, mission }: { astronaut: string; mission?: TrainingMission }) {
  const [readings, setReadings] = useState<Pick<State, 'oxygen' | 'battery'>>();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void readSimulation(loadRun(runKey(astronaut, mission)), mission, controller.signal).then((result) => {
      if (!controller.signal.aborted) setReadings({ oxygen: result.oxygen, battery: result.battery });
    }).catch(() => {
      if (!controller.signal.aborted) setUnavailable(true);
    });
    return () => controller.abort();
  }, [astronaut, mission]);

  if (!readings) return <small>{unavailable ? 'Base readings unavailable.' : 'Checking base readings…'}</small>;
  return <dl className="brief-base-readings" aria-label="Base readings">
    <div data-low={readings.oxygen <= 25}>
      <dt>Base oxygen</dt><dd>{oneDecimal.format(readings.oxygen)}%</dd>
    </div>
    <div data-low={readings.battery <= 25}>
      <dt>Base battery</dt><dd>{Math.round(readings.battery)}%</dd>
    </div>
  </dl>;
}

export default function BaseSystems({ astronaut, headingRef, onClose, onStore, mission, onComplete, location }: {
  astronaut: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  mission?: TrainingMission;
  location: BuildingId | null;
  onComplete?: () => void;
  onStore?: (count: number) => void;
}) {
  const storageKey = runKey(astronaut, mission);
  const [save, setSave] = useState(() => loadRun(storageKey));
  const lastTurn = save.turns.at(-1);
  const [oxygen, setOxygen] = useState(lastTurn?.oxygen ?? 6);
  const [lighting, setLighting] = useState(lastTurn?.lighting ?? 4);
  const [sending, setSending] = useState(false);
  const replyTimer = useRef<number | undefined>(undefined);
  const [crop, setCrop] = useState<Crop>(lastTurn?.crop ?? 'lettuce');
  const [state, setState] = useState<State>();
  const [busy, setBusy] = useState(true);
  const [turnFeedback, setTurnFeedback] = useState('');
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);

  async function update(next: Save, action?: Action, actionCrop = crop) {
    const controller = new AbortController();
    if (pending.current) return;
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await readSimulation(next, mission, controller.signal);
      if (controller.signal.aborted) return;
      if (mission && mission !== 'food' && action && state) {
        const changes = [
          ['Crew oxygen', result.oxygen - state.oxygen],
          ['Battery', result.battery - state.battery],
        ] as const;
        setTurnFeedback(changes.map(([label, amount]) =>
          `${label} ${Math.abs(amount) < .05 ? 'held steady' : `${amount > 0 ? '+' : '−'}${oneDecimal.format(Math.abs(amount))} pts`}`
        ).join(' · '));
      } else {
        setTurnFeedback('');
      }
      setState(result);
      setSave(next);
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
      catch { /* Keep this run in memory when storage is unavailable. */ }
      if (!mission && action === 'store' && state) {
        const collected = (result.stored[actionCrop] ?? 0) - (state.stored[actionCrop] ?? 0);
        if (collected > 0) onStore?.(collected);
      }
    } catch {
      if (!controller.signal.aborted) setError('Signal lost. Try again.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  }

  useEffect(() => {
    void update(save);
    return () => {
      window.clearTimeout(replyTimer.current);
      pending.current?.abort();
      pending.current = null;
    };
  }, []);

  const atSolarArray = location === 'solar';
  const atGreenhouse = location === 'greenhouse';

  function act(action: Action, power = { oxygen, lighting, shielding: 0 }, actionCrop = crop) {
    if (busy || finished || !state) return;
    if (action === 'clean' && !atSolarArray) return;
    if ((['plant', 'water', 'harvest', 'refill', 'store'].includes(action)) && !atGreenhouse) return;
    void update({ ...save, turns: [...save.turns, { action, ...power, crop: actionCrop }] }, action, actionCrop);
  }

  const finished = !!(state?.failure || state?.goalMet);
  const lesson = mission ? training[mission] : undefined;
  const lowBattery = mission === 'oxygen' && !!state && state.battery < 1;
  const needsRestart = lowBattery && state.oxygen < 35 && !finished;

  function retry() {
    setOxygen(6);
    setLighting(4);
    setCrop('lettuce');
    void update(newRun());
  }

  function complete() {
    if (!state?.goalMet || !onComplete || sending) return;
    if (mission === 'storm') {
      setSending(true);
      replyTimer.current = window.setTimeout(onComplete, 2600);
    } else {
      onComplete();
    }
  }
  const growth = state?.growth[crop] ?? [];
  const ready = growth.filter((value) => value >= 100).length;
  const occupied = Object.values(state?.growth ?? {}).reduce((count, plants) => count + plants.length, 0);
  const canWater = !!state && state.wateringDueIn > 0 && state.water >= occupied * .5 && occupied > 0;

  const oxygenPlan = { oxygen: 6, lighting: 0, shielding: 0 };
  const cropPlan = { oxygen: 4, lighting: 4, shielding: 0 };
  const shelterPlan = { oxygen: 6, lighting: 0, shielding: 5 };
  const trainingCrop = crops.find((name) => state?.harvest[name])
    ?? crops.find((name) => state?.growth[name]?.some((value) => value >= 100))
    ?? crops.find((name) => state?.growth[name]?.length)
    ?? 'lettuce';
  const cropProgress = Math.max(0, ...(state?.growth[trainingCrop] ?? []));
  const harvestWaiting = !!state?.harvest[trainingCrop];
  const watered = state?.watered && state.wateringDueIn > 4;
  const foodStep = harvestWaiting ? 3 : cropProgress >= 100 ? 2 : watered ? 1 : 0;
  const foodAction = (['water', 'wait', 'harvest', 'store'] as const)[foodStep];
  const foodNeedsRetry = !!state && !harvestWaiting && cropProgress < 100
    && (occupied === 0 || (!watered && !canWater));
  const choices = state && mission === 'storm'
    ? [
        { label: 'Power the shelter', detail: 'Crew protected', action: 'wait', power: shelterPlan },
        { label: 'Keep the greenhouse lit', detail: 'Crew exposed', action: 'wait', power: { ...cropPlan, oxygen: 6 } },
    ] as const
    : [];

  return <div className="building-info base-systems" aria-busy={busy}>
    <h2 ref={headingRef} tabIndex={-1}>{lesson?.title ?? 'Base systems'}</h2>
    {lesson && <p className="station-goal">{lesson.goal}</p>}
    {error && <div className="base-feedback" role="alert">
      <p>{error}</p>
      {!state && <button className="research-secondary" onClick={() => void update(save)}>Try again</button>}
    </div>}
    {!state && busy && <p role="status">Checking the base…</p>}
    {state && <>
      {mission === 'storm' && state.solarStorm && !state.failure && <p className="storm-warning" role="status">
        Storm incoming! Pick what to power.
      </p>}
      <div className="station-readout" hidden={mission === 'food' && !busy}>
        {mission === 'oxygen' && <div className="station-meter">
          <label htmlFor="crew-air"><span>Oxygen</span><strong>{oneDecimal.format(state.oxygen)}% / 37%</strong></label>
          <progress id="crew-air" value={state.oxygen} max={Math.max(37, state.oxygen)} />
        </div>}
        {mission === 'storm' && <div className="station-meter exposure-meter">
          <label htmlFor="crew-exposure"><span>Radiation</span><strong>{oneDecimal.format(state.exposure)} / 15</strong></label>
          <progress id="crew-exposure" value={Math.min(state.exposure, 15)} max={15} />
        </div>}
        <p className="base-time">Battery {Math.round(state.battery)}% · Day {state.sol}, hour {state.hour}</p>
        {mission === 'oxygen' && save.turns.length > 0 && <p className="station-received">Generator got {oneDecimal.format(state.oxygenPower)} kW last hour</p>}
        <div className="base-feedback" role="status">
          {busy ? <p>Running the base…</p> : <>
            {turnFeedback && <p key={save.turns.length} className="turn-result">{turnFeedback}</p>}
            {state.messages.map((message) => <p key={message}>{message}</p>)}
          </>}
        </div>
      </div>
      {finished ? <>
        {state.goalMet ? <>
          <p role="status">{sending ? 'Waiting for Earth…' : mission === 'storm' ? 'Crew safe!' : 'Mission complete!'}</p>
          <button className="outpost-primary" disabled={sending || busy} onClick={complete}>{mission === 'storm' ? 'Send report to Earth' : 'Finish mission'}</button>
        </> : <>
        <p role="status">{state.failure}</p>
        <button className="outpost-primary" disabled={busy} onClick={retry}>{mission ? 'Retry mission' : 'Start a new base run'}</button>
        </>}
      </> : <>
        {needsRestart && <div className="oxygen-recovery">
          <p role="status">Battery empty! Try again with a charged battery.</p>
          <button className="outpost-primary" disabled={busy} onClick={retry}>Retry oxygen mission</button>
        </div>}
        {mission === 'oxygen' && atSolarArray && <fieldset disabled={busy}>
          <legend>{state.cleanliness < 100 ? 'Step 1 · Clean the panels' : 'Step 2 · Choose power'}</legend>
          {state.cleanliness < 100 ? <button className="outpost-primary" onClick={() => act('clean', oxygenPlan)}>Clean solar panels</button>
            : <>
            <p className="station-next">{lowBattery ? 'Low power can still drain oxygen.' : 'Keep powering oxygen until you reach 37%.'}</p>
            <div className="mission-choices quick-choices" role="group" aria-label="Power for the next 4 hours">
              <button onClick={() => act('wait', oxygenPlan)}>
                <strong>6 kW · Power oxygen</strong><span>{lowBattery ? 'Lights off · Saves power' : 'More air · Lights off'}</span>
              </button>
              <button onClick={() => act('wait', { ...cropPlan, oxygen: 2 })}>
                <strong>2 kW · Power the lights</strong><span>Less air · Lights on</span>
              </button>
            </div>
            </>}
        </fieldset>}
        {mission && choices.length > 0 && <fieldset disabled={busy}>
          <legend>{state.solarStorm ? 'Storm incoming' : 'Get the shelter ready'}</legend>
          <div className="mission-choices">
            {choices.map(({ label, detail, action, power }) => <button key={label} onClick={() => act(action, power)}>
              <strong>{label}</strong><span>{detail}</span>
            </button>)}
          </div>
        </fieldset>}
        {!mission && <>

        <fieldset disabled={busy}>
          <legend>Power settings</legend>
          <label htmlFor="base-oxygen">Oxygen generation <strong>{oxygen} kW</strong></label>
          <input id="base-oxygen" type="range" min="0" max="6" value={oxygen} onChange={(event) => setOxygen(event.currentTarget.valueAsNumber)} />
          <small>Last hour received {oneDecimal.format(state.oxygenPower)} kW</small>
          <label htmlFor="base-lighting">Greenhouse lights <strong>{lighting} kW</strong></label>
          <input id="base-lighting" type="range" min="0" max="4" value={lighting} onChange={(event) => setLighting(event.currentTarget.valueAsNumber)} />
          <small>Last hour received {oneDecimal.format(state.lightingPower)} kW</small>
          <div className="base-actions">
            <button onClick={() => act('wait')}>Advance 4 hours</button>
            {atSolarArray && <button onClick={() => act('clean')} disabled={state.cleanliness >= 100}>Clean solar panels</button>}
          </div>
        </fieldset>
        </>}
        {atGreenhouse && mission === 'food' && <div className="food-guide">
          {foodNeedsRetry ? <>
            <p>Try again with a fresh seedling.</p>
            <button className="outpost-primary" disabled={busy} onClick={retry}>Get a fresh seedling</button>
          </> : <>
            <div className="food-guide-plant" aria-hidden="true">{foodStep === 3 ? '🥬' : '🌱'}</div>
            <div className="station-meter">
              <label htmlFor="dinner-growth"><span>{harvestWaiting ? 'Harvest ready to store' : 'Crop growth'}</span><strong>{harvestWaiting ? 100 : Math.floor(cropProgress)}%</strong></label>
              <progress id="dinner-growth" value={harvestWaiting ? 100 : cropProgress} max={100} />
            </div>
            <ol className="food-steps" aria-label="Greenhouse steps">
              {['Water', 'Grow', 'Pick', 'Store'].map((step, index) => <li key={step} aria-current={index === foodStep ? 'step' : undefined}>
                {index < foodStep ? <span aria-label="Done">✓</span> : null}{step}
              </li>)}
            </ol>
            <button className="outpost-primary" disabled={busy} onClick={() => act(foodAction, cropPlan, trainingCrop)}>
              {['Water the plant', 'Turn on grow lights', 'Pick the crop', 'Put food in the box'][foodStep]}
            </button>
          </>}
        </div>}
        {atGreenhouse && !mission && <fieldset disabled={busy}>
          <legend>Greenhouse</legend>
          <p>{oneDecimal.format(state.water)} L water · {occupied}/8 plots
            {occupied > 0 && ` · Water in ${state.wateringDueIn}h`}</p>
          <label htmlFor="base-crop">Crop</label>
          <select id="base-crop" value={crop} onChange={(event) => setCrop(event.currentTarget.value as Crop)}>
            <option value="lettuce">Lettuce</option>
            <option value="tomato">Tomato</option>
          </select>
          <p>{state.seeds[crop]} seeds · {ready} ready · {state.harvest[crop] ?? 0} waiting to store · {state.stored[crop] ?? 0} stored</p>
          {growth.length > 0 && <div className="crop-growth">
            {growth.map((value, index) => <div key={index}>
              <label><span>{crop} {index + 1}</span><strong>{Math.floor(value)}%</strong></label>
              <progress aria-label={`${crop} ${index + 1} growth`} value={value} max={100} />
            </div>)}
          </div>}
          <div className="base-actions">
            <button onClick={() => act('plant')} disabled={!state.seeds[crop] || occupied >= 8}>Plant seed</button>
            <button onClick={() => act('harvest')} disabled={!ready}>Harvest crops</button>
            <button onClick={() => act('water')} disabled={!canWater}>Water plants</button>
            <button onClick={() => act('store')} disabled={!state.harvest[crop]}>Store crops</button>
            <button onClick={() => act('refill')} disabled={state.water >= 10}>Refill water tank</button>
          </div>
        </fieldset>}
      </>}
      {!mission && !atSolarArray && !atGreenhouse && <p>Visit the Solar Array or Greenhouse.</p>}
    </>}
    {mission === 'storm' && <details><summary>Real mission science</summary><p>This drill is based on a solar particle event recorded by NASA’s Lunar Reconnaissance Orbiter on 28 October 2021. Exposure below uses game points. <a href="https://www.esa.int/articles/giant-solar-eruption-felt-on-earth-moon-and-mars" target="_blank" rel="noreferrer">See the observation</a>.</p></details>}
    <button className="research-secondary" disabled={sending} onClick={onClose}>Back to exploring</button>
  </div>;
}
