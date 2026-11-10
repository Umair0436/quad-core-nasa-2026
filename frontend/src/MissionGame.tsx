import { lazy, Suspense, useRef, useState } from 'react';
import type { Mission, ModuleId, Resource } from './api';
import { makeDecision, startMission } from './api';

const Outpost = lazy(() => import('./components/Outpost'));
const modules: { id: ModuleId; title: string; number: string; detail: string }[] = [
  { id: 'habitat', title: 'Habitat', number: '01', detail: 'Air & life support' },
  { id: 'shelter', title: 'Storm shelter', number: '02', detail: 'Crew protection' },
  { id: 'greenhouse', title: 'Greenhouse', number: '03', detail: 'Food & energy' },
];
const resources: { key: Resource; label: string; symbol: string; color: string }[] = [
  { key: 'oxygen', label: 'Oxygen', symbol: 'O₂', color: '#75dfd1' },
  { key: 'power', label: 'Power', symbol: 'ϟ', color: '#f5cb83' },
  { key: 'food', label: 'Food', symbol: '✳', color: '#badd8d' },
];

export default function MissionGame({ initialMission, astronautName, onBack }: { initialMission: Mission; astronautName: string; onBack: () => void }) {
  const [mission, setMission] = useState<Mission | null>(initialMission);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ModuleId>('habitat');
  const [briefingRead, setBriefingRead] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const requestPending = useRef(false);
  const decisionTitle = useRef<HTMLHeadingElement>(null);
  const playing = mission?.state.status === 'playing';
  const finished = mission && !playing;

  async function update(action?: string) {
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = action && mission ? await makeDecision(mission.token, action) : await startMission();
      setMission(result);
      setSelected(result.decision?.module ?? 'habitat');
      requestAnimationFrame(() => decisionTitle.current?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
      requestPending.current = false;
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#main"><span className="brand-mark" aria-hidden="true">◒</span> LUNA<span className="muted">—</span>01</a>
      <span className="topbar-label">COMMANDER {astronautName.toUpperCase()}</span>
      <button className="team-tag back-to-launch" onClick={onBack}>← CHOOSE ASTRONAUT</button>
    </header>

    <main id="main">
      <div className="mission-heading">
        <div><p className="eyebrow">MOON OUTPOST / TRAINING MISSION</p><h1>A small crew.<br className="mobile-break" /> A big responsibility.</h1><p className="intro">Keep your crew safe for three days. Every choice counts.</p></div>
        <div className="day-badge"><span>MISSION PROGRESS</span><strong>{mission ? `DAY ${mission.state.day}` : 'READY TO LAUNCH'}<small>{mission ? ' / 03' : ''}</small></strong><div className="day-dots">{[1, 2, 3].map((day) => <i key={day} className={mission && day <= mission.state.day ? 'filled' : ''} />)}</div></div>
      </div>

      <div className="game-layout">
        <section className="outpost-panel" aria-label="Moon outpost">
          <div className="scene-top"><span><span className="status-dot" /> LUNAR BASE ALPHA</span><span>3D OUTPOST VIEW</span></div>
          <div className="scene" aria-label="Interactive three-dimensional Moon outpost. Module buttons are also available below.">
            <Suspense fallback={<div className="scene-fallback">Preparing your Moon outpost…</div>}><Outpost active={playing ? mission.decision?.module : undefined} onSelect={setSelected} /></Suspense>
            <div className="scene-caption"><span className="eyebrow">YOUR HOME, FAR FROM HOME</span><p>Explore the outpost.<br />Look after the people inside.</p></div>
            <span className="scene-coordinate">SECTOR 01 · MOON</span>
          </div>
          <div className="module-tabs" aria-label="Outpost modules">{modules.map((module) => <button key={module.id} className={selected === module.id ? 'module selected' : 'module'} onClick={() => setSelected(module.id)} aria-pressed={selected === module.id}>
            <span className="module-number">{module.number}</span><span><strong>{module.title}</strong><small>{module.detail}</small></span>{playing && mission.decision?.module === module.id && <span className="module-alert" aria-label="Decision available">●</span>}
          </button>)}</div>
          <div className="outpost-note"><span aria-hidden="true">↗</span> {playing ? 'The glowing marker shows where your next decision is waiting.' : 'Click a building or use the buttons to explore your base.'}</div>
        </section>

        <aside className="control-panel" aria-label="Mission controls">
          <div className="panel-heading"><span className="eyebrow">MISSION CONTROL</span><span className="small-tag">{finished ? 'COMPLETE' : 'TRAINING'}</span></div>
          {!mission ? <div className="briefing">
            <span className="section-number">YOUR FIRST ASSIGNMENT</span><h2>Welcome, commander.</h2><p>Your crew is counting on you. Balance air, energy, and food while keeping everyone protected.</p>
            <ol className="briefing-steps"><li><span>01</span> Read the situation.</li><li><span>02</span> Choose what your crew does.</li><li><span>03</span> See the trade-off. Plan tomorrow.</li></ol>
            <label className="briefing-check"><input type="checkbox" checked={briefingRead} onChange={(event) => setBriefingRead(event.target.checked)} /> I'm ready to look after my crew.</label>
            <button className="primary-button" disabled={busy || !briefingRead} onClick={() => void update()}>{busy ? 'Contacting mission control…' : 'Start my mission'}<span aria-hidden="true">↗</span></button>
            <p className="microcopy">Three days · Three decisions · One crew</p>
          </div> : <>
            <div className="resource-list">{resources.map(({ key, label, symbol, color }) => <div className="resource" key={key}>
              <div className="resource-title"><span><i style={{ color }}>{symbol}</i>{label}</span><strong>{mission.state[key]}<small> / 100</small></strong></div>
              <div className="resource-track" role="meter" aria-label={label} aria-valuenow={mission.state[key]} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${mission.state[key]}%`, background: mission.state[key] <= 20 ? '#f29783' : color }} /></div>
            </div>)}</div>
            <div className={`radiation ${mission.state.radiation >= 50 ? 'elevated' : ''}`}><span>☀ Radiation exposure</span><strong>{mission.state.radiation}/100</strong><small>Higher is worse · game limit 80</small></div>
            {mission.feedback && <div className="feedback" role="status"><span className="eyebrow">WHAT YOUR CREW LEARNED</span><p>{mission.feedback}</p></div>}
            {finished ? <div className="result">
              <span className="section-number">MISSION DEBRIEF</span><h2 ref={decisionTitle} tabIndex={-1}>{mission.state.status === 'won' ? 'Crew safe. Mission complete.' : 'A lesson for the next mission.'}</h2><p>{mission.reason}</p>
              <button className="primary-button" disabled={busy} onClick={() => void update()}>{busy ? 'Preparing…' : 'Try a new mission'}<span aria-hidden="true">↗</span></button>
            </div> : mission.decision && <div className="decision">
              <span className="section-number">DAY {mission.state.day} / {modules.find((module) => module.id === selected)?.title.toUpperCase()}</span>
              {selected === mission.decision.module ? <>
                <h2 ref={decisionTitle} tabIndex={-1}>{mission.decision.title}</h2><p>{mission.decision.description}</p>
                <div className="choices">{mission.decision.choices.map((choice) => <button className="choice" key={choice.id} disabled={busy} onClick={() => void update(choice.id)}>
                  <strong>{choice.label}<span aria-hidden="true">↗</span></strong><span className="choice-description">{choice.description}</span><span className="effect-list">{Object.entries(choice.effects).map(([key, value]) => <span key={key}>{value > 0 ? '+' : ''}{value} {key}</span>)}</span>
                </button>)}</div><p className="microcopy">Each day also uses 14 oxygen · 10 power · 12 food.</p>
              </> : <><h2>All quiet here.</h2><p>Your next decision is at the {modules.find((module) => module.id === mission.decision?.module)?.title.toLowerCase()}.</p><button className="primary-button" onClick={() => setSelected(mission.decision!.module)}>Go to next decision <span aria-hidden="true">↗</span></button></>}
            </div>}
          </>}
          {busy && mission && <p role="status" className="microcopy">Updating your mission…</p>}
          {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => void update()} disabled={busy}>Start a fresh mission</button></div>}
        </aside>
      </div>

      <footer className="footer"><p><span className="status-dot" /> BUILT FOR CURIOUS EXPLORERS, AGES 7–12</p><button onClick={() => setShowSources(!showSources)} aria-expanded={showSources}>The science behind the mission {showSources ? '−' : '+'}</button></footer>
      {showSources && <section className="sources"><h2>Real ideas. Simplified game rules.</h2><p>Resource meters use invented game points. The solar alert is simulated. This starter does not yet load NASA datasets or live weather. Its numbers are not physical measurements or radiation-dose predictions.</p><p>Research starting points: <a href="https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/" target="_blank" rel="noreferrer">NASA life support</a> · <a href="https://ccmc.gsfc.nasa.gov/tools/DONKI/" target="_blank" rel="noreferrer">NASA DONKI space-weather records</a> · <a href="https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/" target="_blank" rel="noreferrer">Growing plants in space</a>.</p><p>The next science milestone is to add a curated NASA event, retain its original date and source, and document how it informs the simplified mission.</p></section>}
    </main>
  </div>;
}
