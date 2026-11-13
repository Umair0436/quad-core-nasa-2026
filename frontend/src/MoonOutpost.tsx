import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { Astronaut } from './MissionBriefing';
import { makeDecision, startMission } from './api';
import type { Choice, GameState, Mission, ModuleId, Resource } from './api';
import './outpost.css';
import './fullscreen-game.css';
import type { ExplorerHandle } from './components/ThirdPersonOutpost';
export function preloadOutpostScene() {
  return import('./components/ThirdPersonOutpost');
}

const ThirdPersonOutpost = lazy(preloadOutpostScene);

const buildings: { id: ModuleId; name: string; description: string; icon: string; color: string }[] = [
  { id: 'habitat', name: 'Habitat', description: 'Air & life support', icon: 'O₂', color: '#8ae2d3' },
  { id: 'shelter', name: 'Storm shelter', description: 'Keep the crew safe', icon: '◇', color: '#ffd08a' },
  { id: 'greenhouse', name: 'Greenhouse', description: 'Food & energy', icon: '✳', color: '#b7d990' },
];
const supplies: { id: Resource; label: string; icon: string; color: string }[] = [
  { id: 'oxygen', label: 'Oxygen', icon: 'O₂', color: '#8ae2d3' },
  { id: 'power', label: 'Power', icon: 'ϟ', color: '#f2ce8b' },
  { id: 'food', label: 'Food', icon: '✳', color: '#b7d990' },
  { id: 'radiation', label: 'Radiation', icon: '☀', color: '#ffba91' },
];
const objectives: Record<ModuleId, { title: string; instruction: string }> = {
  habitat: {
    title: 'Keep the air flowing',
    instruction: 'Visit the habitat to help your crew breathe.',
  },
  shelter: {
    title: 'Solar alert',
    instruction: 'Reach the storm shelter to protect your crew.',
  },
  greenhouse: {
    title: 'Feed the crew on the final day',
    instruction: 'Check your battery before choosing how to feed the crew.',
  },
};

const resources: Resource[] = ['oxygen', 'power', 'food', 'radiation'];

type LogEntry = { day: number; choice: string; lesson: string };
type Review = { day: number; choice: string; before: GameState };

function hasValidSupplies(state: GameState | undefined) {
  return Boolean(state && resources.every((key) => Number.isFinite(state[key]) && state[key] >= 0 && state[key] <= 100));
}

function readSavedMission(id: string): { mission: Mission; log: LogEntry[]; review: Review | null } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`luna-mission-v1-${id}`) ?? 'null');
    if (!saved || Date.now() - saved.updatedAt > 90 * 60 * 1000) return null;
    const mission = saved.mission as Mission;
    if (!Number.isFinite(mission?.rules?.radiation_limit) || !Number.isInteger(mission?.rules?.mission_days) || !mission?.rules?.daily_costs) return null;
    if (mission?.state?.status === 'playing' && (!mission.decision || !Array.isArray(mission.decision.choices))) return null;
    if (typeof mission?.token !== 'string' || !mission.rules || !mission.state || !['playing', 'won', 'lost'].includes(mission.state.status)) return null;
    if (!Number.isInteger(mission.state.day) || mission.state.day < 1 || mission.state.day > mission.rules.mission_days) return null;
    if (!hasValidSupplies(mission.state)) return null;
    const log = Array.isArray(saved.log) ? saved.log.filter((entry: LogEntry) =>
      entry && typeof entry.choice === 'string' && typeof entry.lesson === 'string' && Number.isInteger(entry.day)
    ).slice(0, mission.rules.mission_days) : [];
    const review = saved.review as Review | undefined;
    const reviewedDay = mission.state.day - (mission.state.status === 'playing' ? 1 : 0);
    const validReview = review && reviewedDay > 0 && review.day === reviewedDay &&
      review.before?.day === reviewedDay && typeof review.choice === 'string' && hasValidSupplies(review.before);
    return { mission, log, review: validReview ? review : null };
  } catch { return null; }
}

function FinalDayForecast({ mission, choice }: { mission: Mission; choice: Choice }) {
  const remaining = (resource: 'power' | 'food') => Math.min(100, Math.max(0,
    mission.state[resource] + (mission.rules.daily_costs[resource] ?? 0) + (choice.effects[resource] ?? 0)
  ));
  const power = remaining('power');
  const food = remaining('food');

  return <span className="final-day-forecast">
    After daily use:
    <span className={power === 0 ? 'forecast-empty' : undefined}> {power} power</span>
    {' · '}
    <span className={food === 0 ? 'forecast-empty' : undefined}>{food} food</span>
  </span>;
}

export default function MoonOutpost({ astronaut, headingRef, onSound }: { astronaut: Astronaut; headingRef: RefObject<HTMLHeadingElement | null>; onSound: () => void }) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ModuleId>('habitat');
  const [opened, setOpened] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [showScience, setShowScience] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [nearby, setNearby] = useState<ModuleId | null>(null);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const firstLoad = useRef<Promise<Mission> | null>(null);
  const pending = useRef(false);
  const decisionHeading = useRef<HTMLHeadingElement>(null);
  const explorer = useRef<ExplorerHandle>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  async function toggleFullscreen() {
    setFullscreenNotice(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenNotice('Fullscreen is unavailable here. Your game still fills this browser window.');
    } finally {
      requestAnimationFrame(() => { if (!opened && !review && mission?.state.status === 'playing') explorer.current?.focus(); });
    }
  }

  useEffect(() => {
    let active = true;
    const saved = readSavedMission(astronaut.id);
    if (saved) {
      setMission(saved.mission);
      setLog(saved.log);
      setReview(saved.review);
      setPanelVisible(Boolean(saved.review || saved.mission.state.status !== 'playing'));
      setSelected(saved.mission.decision?.module ?? 'habitat');
      setBusy(false);
    } else {
      firstLoad.current ??= startMission();
      firstLoad.current.then((result) => {
        if (active) { setMission(result); setSelected(result.decision?.module ?? 'habitat'); setBusy(false); }
      }).catch((cause) => {
        if (active) { setError(cause instanceof Error ? cause.message : 'Mission control could not connect. Try again.'); setBusy(false); }
      });
    }
    return () => { active = false; };
  }, [astronaut.id]);

  useEffect(() => {
    if (!mission) return;
    try { sessionStorage.setItem(`luna-mission-v1-${astronaut.id}`, JSON.stringify({ mission, log, review, updatedAt: Date.now() })); }
    catch { /* A mission can still be played when browser storage is unavailable. */ }
  }, [astronaut.id, mission, log, review]);

  function inspectBuilding(id: ModuleId) {
    if (busy || review || mission?.state.status !== 'playing') return;
    setSelected(id); setOpened(true); setPanelVisible(true); onSound();
    requestAnimationFrame(() => decisionHeading.current?.focus());
  }

  function guideToBuilding(id: ModuleId) {
    if (busy || review || mission?.state.status !== 'playing') return;
    const stage = explorer.current;
    if (!stage) return;
    setOpened(false); setPanelVisible(false); setSelected(id);
    if (!stage.walkTo(id)) inspectBuilding(id);
  }

  function resumeExploring() {
    setOpened(false); setPanelVisible(false);
    requestAnimationFrame(() => explorer.current?.focus());
  }

  async function choose(id: string) {
    if (!mission || pending.current || review || mission.state.status !== 'playing') return;
    const choice = mission.decision?.choices.find((item) => item.id === id);
    if (!choice) return;
    pending.current = true; setBusy(true); setError(null); onSound();
    try {
      const result = await makeDecision(mission.token, id);
      setReview({ day: mission.state.day, choice: choice.label, before: mission.state });
      setLog((previous) => [...previous, { day: mission.state.day, choice: choice.label, lesson: result.feedback ?? '' }]);
      setMission(result);
      requestAnimationFrame(() => decisionHeading.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That choice could not be sent. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }

  async function restart() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); onSound();
    try {
      const result = await startMission();
      setMission(result); setLog([]); setReview(null); setSelected('habitat'); setOpened(false); setPanelVisible(false); explorer.current?.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mission control could not connect. Try again.'); }
    finally { pending.current = false; setBusy(false); }
  }

  function nextDay() {
    setReview(null); setOpened(false); setPanelVisible(Boolean(mission && mission.state.status !== 'playing')); setSelected(mission?.decision?.module ?? 'habitat'); onSound();
    requestAnimationFrame(() => mission?.state.status === 'playing' ? explorer.current?.focus() : decisionHeading.current?.focus());
  }

  const currentDay = review?.day ?? mission?.state.day ?? 1;
  const activeBuilding = mission?.decision?.module;
  const finished = mission && mission.state.status !== 'playing';
  const building = buildings.find((item) => item.id === selected)!;
  const radiationLimit = mission?.rules.radiation_limit ?? 80;
  const objective = activeBuilding ? objectives[activeBuilding] : null;
  const destination = buildings.find((item) => item.id === activeBuilding);
  const atDestination = activeBuilding === nearby;
  const closeMenu = () => { if (menu.current) menu.current.open = false; };
  const solarAlert = activeBuilding === 'shelter' && !review && !finished;
  const heading = !mission ? 'Moon outpost' : finished && !review ? (mission.state.status === 'won' ? 'Mission accomplished!' : 'Try again') : `Day ${currentDay} of ${mission.rules.mission_days}`;

  return <main className="outpost-main" id="outpost-main">
    <header className="game-top">
      <h1 ref={headingRef} tabIndex={-1}><span>{astronaut.name}</span> · {heading}</h1>
      <details className="game-menu" ref={menu}>
        <summary>Menu</summary>
        <nav aria-label="Game menu">
          <a href={`#briefing/${astronaut.id}`}>Back to briefing</a>
          <button onClick={() => { closeMenu(); void toggleFullscreen(); }}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
          <button onClick={() => { closeMenu(); setShowScience(true); }}>About the science</button>
        </nav>
      </details>
    </header>

    {mission && <section className="outpost-hud" aria-label="Crew supplies and radiation">
      {supplies.map((item) => {
        const amount = mission.state[item.id];
        const warning = item.id === 'radiation' ? amount >= 50 : amount <= 20;
        return <div className="supply-meter" key={item.id} style={{ '--meter-color': warning ? '#ffac88' : item.color } as CSSProperties}>
          <div><span>{item.label}</span><strong>{amount}</strong></div>
          <div className="supply-track" role="meter" aria-label={item.label} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={amount} aria-valuetext={item.id === 'radiation' ? `${amount} of 100. Safety limit ${radiationLimit}.` : undefined}>
            <span style={{ width: `${amount}%` }} />
          </div>
        </div>;
      })}
    </section>}

    {fullscreenNotice && <div className="fullscreen-note" role="status" onClick={() => setFullscreenNotice(null)}>{fullscreenNotice}</div>}
    {error && <div className="outpost-error" role="alert"><strong>Mission control needs a moment.</strong><p>{error}</p>{!mission && <button onClick={() => void restart()} disabled={busy}>Try connecting again</button>}{mission && <button onClick={() => void restart()} disabled={busy}>Start a fresh mission</button>}</div>}
    <div className="outpost-play-grid exploration-layout">
      <section className="moon-map-panel" aria-label="Third-person Moon outpost">
        <Suspense fallback={<div className="explorer-preparing" role="status">Preparing your Moon outpost…</div>}>
          <ThirdPersonOutpost ref={explorer} astronautId={astronaut.id} suitColor={astronaut.color} active={review || finished ? undefined : activeBuilding} enabled={Boolean(mission) && !busy && !review && !finished && !opened} pauseLabel={review ? 'Review your choice to continue.' : finished ? 'Mission ended.' : 'Choose an action to continue.'} onInteract={inspectBuilding} onNearChange={setNearby} />
          {!panelVisible && objective && destination && <section className={`mission-objective ${solarAlert ? 'solar-alert' : ''}`} aria-label="Current mission objective">
            <div role="status"><h2>{objective.title}</h2><p>{objective.instruction}</p></div>
            <button className="outpost-primary" onClick={() => guideToBuilding(destination.id)}>
              {atDestination ? 'Explore' : 'Go to'} {destination.name.toLowerCase()} <span aria-hidden="true">→</span>
            </button>
          </section>}
        </Suspense>
      </section>

      {mission && <aside id="mission-panel" className={`outpost-decision ${!panelVisible ? 'panel-hidden' : opened || review || finished ? 'panel-expanded' : 'panel-compact'}`} aria-label="Your mission task" aria-busy={busy}>
          <div className="decision-panel-top"><span>{review ? 'DAY REVIEW' : finished ? 'MISSION REPORT' : 'MISSION OBJECTIVE'}</span><span className="decision-day">DAY {currentDay}</span></div>
          {review ? <div className="day-review"><span className="review-symbol" aria-hidden="true">✦</span><h2 ref={decisionHeading} tabIndex={-1}>You made your choice.</h2><p className="chosen-action">{review.choice}</p><div className="day-changes" aria-label="Today's resource changes">{supplies.map((item) => { const delta = mission.state[item.id] - review.before[item.id]; return <div key={item.id}><span>{item.label}</span><strong className={(item.id === 'radiation' ? delta <= 0 : delta >= 0) ? 'change-good' : 'change-cost'}>{delta > 0 ? '+' : ''}{delta}</strong></div>; })}</div><div className="day-lesson" role="status"><span className="briefing-eyebrow">HERE’S THE TRADE-OFF</span><p>{mission.feedback}</p></div><button className="outpost-primary" disabled={busy} onClick={nextDay}>{finished ? 'See my mission report' : `Continue to day ${mission.state.day}`} <span aria-hidden="true">→</span></button></div>
          : finished ? <div className="mission-result"><span className="result-symbol" aria-hidden="true">{mission.state.status === 'won' ? '✦' : '♡'}</span><h2 ref={decisionHeading} tabIndex={-1}>{mission.state.status === 'won' ? `Great work, ${astronaut.name}!` : 'Ready for another try?'}</h2><p>{mission.reason}</p>{log.length > 0 && <ol className="mission-log" aria-label="What your crew learned">{log.map((entry) => <li key={entry.day}>
            <details>
              <summary><span>Day {entry.day}</span> {entry.choice}</summary>
              <p>{entry.lesson}</p>
            </details>
          </li>)}</ol>}<button className="outpost-primary" onClick={() => void restart()} disabled={busy}>{busy ? 'Preparing your crew…' : 'Play again'} <span aria-hidden="true">↻</span></button><a className="choose-different" href="#launch-main">Choose a different astronaut</a></div>
          : !opened ? <div className="task-invitation"><span className="task-round-icon" aria-hidden="true">{buildings.find((item) => item.id === activeBuilding)?.icon}</span><h2 ref={decisionHeading} tabIndex={-1}>{objective?.title}</h2><p>{objective?.instruction}</p><button className="outpost-primary" onClick={() => guideToBuilding(activeBuilding!)}>Walk to the {buildings.find((item) => item.id === activeBuilding)?.name.toLowerCase()} <span aria-hidden="true">→</span></button></div>
          : selected !== activeBuilding ? <div className="building-info"><span className="task-round-icon" style={{ color: building.color }} aria-hidden="true">{building.icon}</span><h2 ref={decisionHeading} tabIndex={-1}>{building.name}</h2><p>{selected === 'habitat' ? 'This is where your crew lives and makes breathable air. It needs power to keep working.' : selected === 'shelter' ? 'This protective space helps keep your crew safer during solar-particle events.' : 'Plants grow here with help from light, water, and power. Today’s crop was planted before this mission.'}</p><p className="building-next">Today’s decision is at the {buildings.find((item) => item.id === activeBuilding)?.name.toLowerCase()}.</p><button className="outpost-primary" onClick={() => guideToBuilding(activeBuilding!)}>Go to today’s task <span aria-hidden="true">→</span></button></div>
          : <div className="choice-panel"><span className="briefing-eyebrow">{building.name.toUpperCase()} · WHAT WILL YOU DO?</span><h2 ref={decisionHeading} tabIndex={-1}>{mission.decision?.title}</h2><p>{mission.decision?.description}</p>
            {activeBuilding === 'greenhouse' && <p className="greenhouse-budget">You have <strong>{mission.state.power} power</strong> and <strong>{mission.state.food} food</strong>. Keep both above zero by the end of the day.</p>}
            <div className="outpost-choices">{mission.decision?.choices.map((choice, index) => <button key={choice.id} disabled={busy} onClick={() => void choose(choice.id)}><span className="choice-top"><i>{index === 0 ? 'A' : 'B'}</i><strong>{choice.label}</strong><span aria-hidden="true">↗</span></span><span className="choice-copy">{choice.description}</span><span className="choice-effects">{Object.entries(choice.effects).map(([key, amount]) => <span key={key} className={(key === 'radiation' ? amount <= 0 : amount > 0) ? 'effect-gain' : 'effect-cost'}>{amount > 0 ? '+' : ''}{amount} {key}</span>)}</span>
            {activeBuilding === 'greenhouse' && <FinalDayForecast mission={mission} choice={choice} />}
            </button>)}</div><p className="daily-upkeep">Your crew also uses {Math.abs(mission.rules.daily_costs.oxygen ?? 0)} oxygen, {Math.abs(mission.rules.daily_costs.power ?? 0)} power, and {Math.abs(mission.rules.daily_costs.food ?? 0)} food each day.</p>{busy && <p className="sending-choice" role="status">Helping your crew…</p>}</div>}
          {opened && !review && !finished && <button className="back-to-exploring" disabled={busy} onClick={resumeExploring}>← Back to exploring</button>}
      </aside>}
    </div>

    {showScience && <section className="outpost-science" aria-label="About the science">
        <h2>About the science</h2>
        <p>The solar alert is simulated. The meters show game points.</p>
        <p><a href="https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/" target="_blank" rel="noreferrer">NASA life support</a> · <a href="https://ccmc.gsfc.nasa.gov/tools/DONKI/" target="_blank" rel="noreferrer">NASA space weather</a> · <a href="https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/" target="_blank" rel="noreferrer">Growing plants in space</a></p>
        <button className="outpost-primary" onClick={() => { setShowScience(false); if (!opened && !review && !finished) explorer.current?.focus(); }}>Close</button>
    </section>}
  </main>;
}
