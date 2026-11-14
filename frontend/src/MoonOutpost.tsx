import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import BaseSystems, { clearTrainingRuns, trainingMissions } from './BaseSystems';
import type { Astronaut } from './MissionBriefing';
import type { ExplorerHandle } from './components/ThirdPersonOutpost';
import { findMoonPath, MOON_BUILDINGS, nearbyBuilding } from './components/moonWorld';
import type { BuildingId, Point } from './components/moonWorld';
import { capacity, deliveries, loadResearch, newMission, outOfSupplies, pickUp, refill, saveResearch, submit, supplies, travel } from './researchMission';
import type { ResearchMission } from './researchMission';
import './outpost.css';
import './fullscreen-game.css';

export function preloadOutpostScene() {
  return import('./components/ThirdPersonOutpost');
}

const ThirdPersonOutpost = lazy(preloadOutpostScene);

export default function MoonOutpost({ astronaut, headingRef, onSound }: {
  astronaut: Astronaut;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSound: () => void;
}) {
  const [mission, setMission] = useState(() => loadResearch(astronaut.id));
  const current = useRef(mission);
  const unreportedDistance = useRef(0);
  const [sceneKey, setSceneKey] = useState(0);
  const [nearby, setNearby] = useState<BuildingId | null>(() => nearbyBuilding(mission.position));
  const [opened, setOpened] = useState<BuildingId | null>(null);
  const [reward, setReward] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showScience, setShowScience] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fullscreenNotice, setFullscreenNotice] = useState(false);
  const explorer = useRef<ExplorerHandle>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const delivery = deliveries[mission.delivered];
  const trainingMission = trainingMissions[mission.delivered];
  const latest = deliveries[mission.delivered - 1];
  const depleted = outOfSupplies(mission);
  const active = delivery ? (mission.carrying ? 'lab' : delivery.site) : 'horizon';
  const destination = MOON_BUILDINGS.find(({ id }) => id === active)!;
  const location = MOON_BUILDINGS.find(({ id }) => id === opened);
  const paused = Boolean(opened || reward || depleted || showScience || showBase || showTraining);

  useEffect(() => {
    const persist = () => saveResearch(astronaut.id, current.current);
    window.addEventListener('pagehide', persist);
    return () => {
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [astronaut.id]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    if (opened || reward || depleted || showScience || showBase || showTraining) panelHeading.current?.focus({ preventScroll: true });
  }, [opened, reward, depleted, showScience, showBase, showTraining]);

  function commit(next: ResearchMission) {
    current.current = next;
    unreportedDistance.current = 0;
    setMission(next);
    saveResearch(astronaut.id, next);
  }

  function onTravel(distance: number, point: Point) {
    const before = current.current;
    if (outOfSupplies(before)) return;
    current.current = travel(before, distance, point);
    unreportedDistance.current += distance;
    if (unreportedDistance.current >= .4 || outOfSupplies(current.current)) commit(current.current);
  }

  function inspect(id: BuildingId) {
    if (outOfSupplies(current.current)) return;
    onSound();
    setOpened(id);
  }

  function goTo(id: BuildingId) {
    const stage = explorer.current;
    if (!stage || outOfSupplies(current.current)) return;
    if (nearby === id) {
      inspect(id);
      return;
    }
    if (stage.walkTo(id)) return;

    // The illustrated map uses the same route length and supply costs.
    const building = MOON_BUILDINGS.find((item) => item.id === id)!;
    const before = current.current;
    const path = findMoonPath(before.position, building.door);
    let point = before.position;
    let distance = 0;
    for (const step of path) {
      distance += Math.hypot(step.x - point.x, step.z - point.z);
      point = step;
    }
    if (!path.length) return;
    commit(travel(before, distance, building.door));
    setNearby(id);
    inspect(id);
  }

  function resume() {
    setOpened(null);
    setReward(false);
    setShowScience(false);
    setShowBase(false);
    setShowTraining(false);
    requestAnimationFrame(() => explorer.current?.focus());
  }

  function collectNote() {
    if (!opened || opened !== nearby) return;
    const next = pickUp(current.current, opened);
    if (next === current.current) return;
    onSound();
    commit(next);
    resume();
  }

  function submitNote() {
    if (!showTraining || nearby !== 'lab') return;
    const next = submit(current.current, 'lab');
    if (next === current.current) return;
    onSound();
    commit(next);
    setOpened(null);
    setShowTraining(false);
    setReward(true);
  }

  function addHarvest(count: number) {
    const before = current.current;
    const food = Math.min(capacity('food', before.delivered), before.supplies.food + count * 10);
    commit({ ...before, supplies: { ...before.supplies, food } });
  }

  function openBaseSystems() {
    if (menu.current) menu.current.open = false;
    setOpened(null);
    setShowBase(true);
  }

  function restock() {
    if (nearby !== 'habitat') return;
    onSound();
    commit(refill(current.current));
    resume();
  }

  function startTrainingAgain() {
    if (delivery) return;
    if (menu.current) menu.current.open = false;
    clearTrainingRuns(astronaut.id);
    commit(newMission());
    setNearby(null);
    setSceneKey((key) => key + 1);
    resume();
  }

  function returnToBase() {
    onSound();
    commit(newMission(current.current.delivered));
    setNearby(null);
    setSceneKey((key) => key + 1);
    resume();
  }

  async function toggleFullscreen() {
    if (menu.current) menu.current.open = false;
    setFullscreenNotice(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenNotice(true);
    }
  }

  return <main className="outpost-main" id="outpost-main">
    <header className="game-top">
      <h1 ref={headingRef} tabIndex={-1}><span>{astronaut.name}</span> · {delivery ? `Mission ${mission.delivered + 1} of ${deliveries.length}` : 'Moon Explorer'}</h1>
      <details className="game-menu" ref={menu}>
        <summary>Menu</summary>
        <nav aria-label="Game menu">
          <a href={`#briefing/${astronaut.id}`}>Back to briefing</a>
          <button onClick={() => void toggleFullscreen()}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
          {!paused && !delivery && <>
            <button onClick={openBaseSystems}>Base systems</button>
            <button onClick={startTrainingAgain}>Start training again</button>
          </>}
          {!showBase && !showTraining && <button onClick={() => { if (menu.current) menu.current.open = false; setShowScience(true); }}>About the science</button>}
        </nav>
      </details>
    </header>

    <section className="outpost-hud" aria-label="Crew supplies">
      {supplies.map(({ id, label, color }) => {
        const amount = Math.ceil(mission.supplies[id]);
        const max = capacity(id, mission.delivered);
        return <div className="supply-meter" key={id} style={{ '--meter-color': amount <= 25 ? '#ff9b86' : color } as CSSProperties}>
          <div><span>{label}</span><strong>{amount}</strong></div>
          <div className="supply-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={amount}>
            <span style={{ width: `${amount / max * 100}%` }} />
          </div>
        </div>;
      })}
    </section>

    <section className="moon-map-panel" aria-label="Explore the Moon outpost">
      <Suspense fallback={<div className="explorer-preparing" role="status">Getting your Moon base ready…</div>}>
        <ThirdPersonOutpost key={sceneKey} ref={explorer} astronautId={astronaut.id} suitColor={astronaut.color}
          start={mission.position} upgrades={mission.delivered} active={paused ? undefined : active} enabled={!paused}
          onInteract={inspect} onNearChange={setNearby} onTravel={onTravel} />
      </Suspense>
    </section>

    {!paused && <section className="mission-objective research-objective" aria-label="Current mission objective">
      <div role="status">
        <h2>{!delivery ? 'Visit your new base' : mission.carrying ? 'Take your note to the Research Lab' : `Find the ${delivery.note.toLowerCase()}`}</h2>
        <p>{!delivery ? 'All three notes are in. Horizon Base is open!' : mission.carrying ? `${delivery.note} is ready. Run the base task at the Research Lab.` : `Pick it up at ${delivery.name}.`}</p>
      </div>
      <button className="outpost-primary" onClick={() => goTo(active)}>{nearby === active ? `Open ${destination.name}` : `Go to ${destination.name}`} <span aria-hidden="true">→</span></button>
      {delivery && <button className="research-secondary" onClick={() => goTo('habitat')}>
        {nearby === 'habitat' ? 'Open Habitat' : 'Refill at Habitat'}
      </button>}
    </section>}

    {fullscreenNotice && <button className="fullscreen-note" onClick={() => setFullscreenNotice(false)}>Fullscreen is unavailable here. Close</button>}

    {paused && <section className="outpost-decision research-panel" aria-label="Moon mission">
      {depleted ? <div className="mission-result">
        <h2 ref={panelHeading} tabIndex={-1}>Out of {depleted.label.toLowerCase()}</h2>
        <p>Head back to base to refill. You can try this delivery again.</p>
        <button className="outpost-primary" onClick={returnToBase}>Back to base <span aria-hidden="true">→</span></button>
      </div> : reward && latest ? <div className="mission-result">
        <h2 ref={panelHeading} tabIndex={-1}>{latest.upgrade}!</h2>
        <p>{latest.benefit} Your supplies are topped up.</p>
        <button className="outpost-primary" onClick={resume}>{delivery ? 'Next mission' : 'Explore Horizon Base'} <span aria-hidden="true">→</span></button>
      </div> : showTraining && trainingMission ? <BaseSystems astronaut={astronaut.id} mission={trainingMission} headingRef={panelHeading}
        onClose={() => { setShowTraining(false); setOpened('lab'); }} onComplete={submitNote} />
      : showBase ? <BaseSystems astronaut={astronaut.id} headingRef={panelHeading} onClose={resume} onHarvest={addHarvest} /> : showScience ? <div className="building-info">
        <h2 ref={panelHeading} tabIndex={-1}>Moon science</h2>
        <p>The supplies use game points. Learn about <a href="https://www.nasa.gov/reference/moonbase-environment/" target="_blank" rel="noreferrer">Moon ice</a>, <a href="https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/" target="_blank" rel="noreferrer">plants in space</a> and <a href="https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/" target="_blank" rel="noreferrer">solar storm shelter</a> from NASA.</p>
        <button className="outpost-primary" onClick={resume}>Back to exploring</button>
      </div> : location && <div className="building-info">
        <h2 ref={panelHeading} tabIndex={-1}>{location.name}</h2>
        {opened === 'habitat' ? <>
          <p>Fill up your oxygen, water, food and power here.</p>
          <button className="outpost-primary" onClick={restock}>Refill supplies</button>
        </> : opened === 'lab' ? mission.carrying ? <>
          <p>Your {delivery?.note.toLowerCase()} is ready. Complete the base task to turn in your report.</p>
          <button className="outpost-primary" onClick={() => { setOpened(null); setShowTraining(true); }}>Start base task</button>
        </> : <p>{delivery ? 'Bring a science note here to earn an upgrade.' : 'All three notes are in the lab.'}</p>
        : opened === delivery?.site && !mission.carrying ? <>
          <h3>{delivery.note}</h3>
          <p>{delivery.finding}</p>
          <button className="outpost-primary" onClick={collectNote}>Pick up note</button>
        </> : <p>{opened === 'horizon' ? delivery ? 'Deliver all three notes to open this base.' : 'Welcome to your new Moon base!' : mission.carrying ? 'Your note is in your pack. Take it to the lab.' : 'Follow your mission marker to the next note.'}</p>}
        {!delivery && (opened === 'habitat' || opened === 'greenhouse') && <button className="research-secondary" onClick={openBaseSystems}>Open base systems</button>}
        <button className="research-secondary" onClick={resume}>Back to exploring</button>
      </div>}
    </section>}
  </main>;
}
