import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import './base-systems.css';

const crops = ['lettuce', 'tomato'] as const;
const turnLimit = 120;
type Crop = typeof crops[number];
type Action = 'wait' | 'clean' | 'water' | 'refill' | 'plant' | 'harvest';
type Turn = { action: Action; oxygen: number; lighting: number; crop: Crop };
type State = {
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

export default function BaseSystems({ astronaut, headingRef, onClose, onHarvest }: {
  astronaut: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  onHarvest: (count: number) => void;
}) {
  const storageKey = `luna-base-v1-${astronaut}`;
  const [save, setSave] = useState(() => loadRun(storageKey));
  const lastTurn = save.turns.at(-1);
  const [oxygen, setOxygen] = useState(lastTurn?.oxygen ?? 6);
  const [lighting, setLighting] = useState(lastTurn?.lighting ?? 4);
  const [crop, setCrop] = useState<Crop>(lastTurn?.crop ?? 'lettuce');
  const [state, setState] = useState<State>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);

  async function update(next: Save, action?: Action) {
    const controller = new AbortController();
    if (pending.current) return;
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/base-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) throw new Error('Base systems request failed');
      const result: State = await response.json();
      if (controller.signal.aborted) return;
      setState(result);
      setSave(next);
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
      catch { /* Keep this run in memory when storage is unavailable. */ }
      if (action === 'harvest' && state) {
        const collected = (result.harvest[crop] ?? 0) - (state.harvest[crop] ?? 0);
        if (collected > 0) onHarvest(collected);
      }
    } catch {
      if (!controller.signal.aborted) setError('Base systems are unavailable. Try again.');
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
      pending.current?.abort();
      pending.current = null;
    };
  }, []);

  function act(action: Action) {
    if (busy || finished || !state) return;
    void update({ ...save, turns: [...save.turns, { action, oxygen, lighting, crop }] }, action);
  }

  const finished = !!state && (state.oxygen <= 0 || save.turns.length >= turnLimit);
  const growth = state?.growth[crop] ?? [];
  const ready = growth.filter((value) => value >= 100).length;
  const occupied = Object.values(state?.growth ?? {}).reduce((count, plants) => count + plants.length, 0);
  const canWater = !!state && state.wateringDueIn > 0 && state.water >= occupied * .5 && occupied > 0;

  return <div className="building-info base-systems" aria-busy={busy}>
    <h2 ref={headingRef} tabIndex={-1}>Base systems</h2>
    {error && <div className="base-feedback" role="alert">
      <p>{error}</p>
      {!state && <button className="research-secondary" onClick={() => void update(save)}>Try again</button>}
    </div>}
    {!state && busy && <p role="status">Checking the base…</p>}
    {state && <>
      <p className="base-time">Sol {state.sol} · Hour {state.hour}
        {state.storm ? ' · Storm now' : state.stormSeen ? ' · Storm passed' : ''}</p>
      <dl className="base-readings">
        <div><dt>Base oxygen</dt><dd>{oneDecimal.format(state.oxygen)}%</dd></div>
        <div><dt>Battery</dt><dd>{Math.round(state.battery)}%</dd></div>
        <div><dt>Solar power</dt><dd>{oneDecimal.format(state.solar)} kW</dd></div>
        <div><dt>Panel cleanliness</dt><dd>{Math.round(state.cleanliness)}%</dd></div>
        <div><dt>Greenhouse</dt><dd>{oneDecimal.format(state.temperature)} °C</dd></div>
        <div><dt>Radiation level</dt><dd>{oneDecimal.format(state.radiation)}</dd></div>
      </dl>
      {finished ? <>
        <p role="status">{state.oxygen <= 0 ? 'The base ran out of oxygen. Try giving more power to oxygen generation.' : 'You completed 20 sols at the base.'}</p>
        <button className="outpost-primary" disabled={busy} onClick={() => {
          setOxygen(6);
          setLighting(4);
          setCrop('lettuce');
          void update(newRun());
        }}>Start a new base run</button>
      </> : <>
        <p>Each action runs the base for 4 lunar hours with your chosen power settings.</p>
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
            <button onClick={() => act('clean')} disabled={state.cleanliness >= 100}>Clean solar panels</button>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Greenhouse</legend>
          <p>{oneDecimal.format(state.water)} L water · {occupied}/8 plots
            {occupied > 0 && ` · Water within ${state.wateringDueIn}h`}</p>
          <label htmlFor="base-crop">Crop</label>
          <select id="base-crop" value={crop} onChange={(event) => setCrop(event.currentTarget.value as Crop)}>
            <option value="lettuce">Lettuce</option>
            <option value="tomato">Tomato</option>
          </select>
          <p>{state.seeds[crop]} seeds · {ready} ready · {state.harvest[crop] ?? 0} harvested</p>
          {growth.length > 0 && <p>Growth {growth.map((value) => `${Math.floor(value)}%`).join(', ')}</p>}
          <div className="base-actions">
            <button onClick={() => act('plant')} disabled={!state.seeds[crop] || occupied >= 8}>Plant seed</button>
            <button onClick={() => act('harvest')} disabled={!ready}>Harvest for suit food</button>
            <button onClick={() => act('water')} disabled={!canWater}>Water crops</button>
            <button onClick={() => act('refill')} disabled={state.water >= 10}>Refill water tank</button>
          </div>
        </fieldset>
      </>}
      <div className="base-feedback" role="status">
        {busy ? <p>Running the base…</p> : state.messages.map((message) => <p key={message}>{message}</p>)}
      </div>
    </>}
    <button className="research-secondary" onClick={onClose}>Back to exploring</button>
  </div>;
}
