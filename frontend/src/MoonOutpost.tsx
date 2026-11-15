import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import BaseSystems, { BaseReadings, clearTrainingRuns, trainingMissions } from './BaseSystems';
import type { Astronaut } from './MissionBriefing';
import type { ExplorerHandle } from './components/ThirdPersonOutpost';
import { findMoonPath, MOON_BUILDINGS, nearbyBuilding } from './components/moonWorld';
import type { BuildingId, Point } from './components/moonWorld';
import { capacity, completeMission, deliveries, loadResearch, newMission, outOfSupplies, refill, saveResearch, travel } from './researchMission';
import type { ResearchMission } from './researchMission';
import './outpost.css';
import './fullscreen-game.css';

export function preloadOutpostScene() {
  return import('./components/ThirdPersonOutpost');
}

const ThirdPersonOutpost = lazy(preloadOutpostScene);
const stationBriefs = {
  solar: 'Clean the panels and bring back the crew’s air.',
  greenhouse: 'Grow and store food for the crew.',
  shelter: 'Shield the crew, then radio Earth.',
  horizon: 'All missions complete. Explore your new base!',
} as const;
const confetti = ['#ffd08a', '#c2a0ff', '#8ae2d3', '#ff9b86'];

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
  const [showBadges, setShowBadges] = useState(false);
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
  const active = delivery?.site ?? 'horizon';
  const destination = MOON_BUILDINGS.find(({ id }) => id === active);
  const location = MOON_BUILDINGS.find(({ id }) => id === opened);
  const paused = Boolean(opened || reward || showBadges || depleted || showScience || showBase || showTraining);

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
    if (opened || reward || showBadges || depleted || showScience || showBase || showTraining) panelHeading.current?.focus({ preventScroll: true });
  }, [opened, reward, showBadges, depleted, showScience, showBase, showTraining]);

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
    if (nearbyBuilding(current.current.position) !== id) return;
    if (id === deliveries[current.current.delivered]?.site) {
      commit(current.current);
      setOpened(null);
      setShowTraining(true);
    } else {
      setOpened(id);
    }
  }

  function visitOnMap(id: BuildingId) {
    if (paused || outOfSupplies(current.current)) return;
    if (nearby === id) {
      inspect(id);
      return;
    }
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
    setShowBadges(false);
    setShowScience(false);
    setShowBase(false);
    setShowTraining(false);
    requestAnimationFrame(() => explorer.current?.focus());
  }

  function finishTraining() {
    const station = nearbyBuilding(current.current.position);
    if (!showTraining || !station || station !== delivery?.site) return;
    const next = completeMission(current.current, station);
    if (next === current.current) return;
    onSound();
    commit(next);
    setOpened(null);
    setShowTraining(false);
    setReward(true);
  }

  function addStoredFood(count: number) {
    const before = current.current;
    const food = Math.min(capacity('food', before.delivered), before.supplies.food + count * 10);
    commit({ ...before, supplies: { ...before.supplies, food } });
  }

  function openBaseSystems() {
    commit(current.current);
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
          {!paused && <button onClick={() => { if (menu.current) menu.current.open = false; setShowBadges(true); }}>My badges</button>}
          {!paused && !delivery && <>
            <button onClick={openBaseSystems}>Base systems</button>
            <button onClick={startTrainingAgain}>Start training again</button>
          </>}
          {!showBase && !showTraining && <button onClick={() => { if (menu.current) menu.current.open = false; setShowScience(true); }}>About the science</button>}
        </nav>
      </details>
    </header>

    {!paused && destination && <section className="outpost-radio-brief" aria-label="Mission briefing">
      <div role="status">
        <strong>{nearby === active ? `At ${destination.name}` : `Head to ${destination.name}`}</strong>
        <p>{stationBriefs[active]}</p>
        <small>{nearby === active ? 'Select the station to start.' : 'Look for the highlighted station.'}</small>
      </div>
      <BaseReadings key={`${astronaut.id}:${mission.delivered}`} astronaut={astronaut.id} mission={trainingMission} />
      {(mission.supplies.oxygen <= 25 || mission.supplies.power <= 25) && <small role="status">Low suit supplies. Refill at Habitat.</small>}
    </section>}

    <section className="moon-map-panel" aria-label="Explore the Moon outpost">
      <Suspense fallback={<div className="explorer-preparing" role="status">Getting your Moon base ready…</div>}>
        <ThirdPersonOutpost key={sceneKey} ref={explorer} astronautId={astronaut.id} suitColor={astronaut.color}
          start={mission.position} upgrades={mission.delivered} active={paused ? undefined : active} enabled={!paused}
          onInteract={inspect} onNearChange={setNearby} onTravel={onTravel} onMapVisit={visitOnMap} />
      </Suspense>
    </section>

    {fullscreenNotice && <button className="fullscreen-note" onClick={() => setFullscreenNotice(false)}>Fullscreen is unavailable here. Close</button>}

    {paused && <section className={`outpost-decision research-panel${reward ? ' badge-celebration-panel' : ''}`} aria-label={reward ? 'Mission reward' : 'Moon mission'}>
      {depleted ? <div className="mission-result">
        <h2 ref={panelHeading} tabIndex={-1}>Out of {depleted.label.toLowerCase()}</h2>
        <p>Head back to base to refill. You can try this mission again.</p>
        <button className="outpost-primary" onClick={returnToBase}>Back to base <span aria-hidden="true">→</span></button>
      </div> : reward && latest ? <div className="mission-result badge-celebration">
        <div className="badge-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <span key={index} style={{
          '--confetti-color': confetti[index % confetti.length],
          '--confetti-x': `${((index * 37) % 97) + 1}%`,
          '--confetti-delay': `${(index % 5) * .07}s`,
          '--confetti-drift': `${index % 2 ? 46 : -46}px`,
        } as CSSProperties} />)}</div>
        <h2 ref={panelHeading} tabIndex={-1}>{delivery ? `Great job, ${astronaut.name}!` : `Moon hero, ${astronaut.name}!`}</h2>
        <p>{latest.cheer}</p>
        <div className="mission-medal" aria-hidden="true">{latest.badgeIcon}</div>
        <strong className="earned-badge">{latest.badge} badge earned!</strong>
        <p className="badge-count">{mission.delivered} of {deliveries.length} badges</p>
        <p className="reward-upgrade"><strong>{latest.upgrade}</strong><br />{latest.benefit}</p>
        <button className="outpost-primary" onClick={resume}>{delivery ? 'Next mission' : 'Explore Horizon Base'} <span aria-hidden="true">→</span></button>
      </div> : showBadges ? <div className="building-info moon-badge-book">
        <h2 ref={panelHeading} tabIndex={-1}>My badges</h2>
        <ul className="moon-badge-list">{deliveries.map(({ badge, badgeIcon, name }, index) => {
          const earned = index < mission.delivered;
          return <li key={badge} data-earned={earned}>
            <span aria-hidden="true">{earned ? badgeIcon : '☆'}</span>
            <div><strong>{badge}</strong><small>{earned ? 'Earned' : `Finish the ${name} mission`}</small></div>
          </li>;
        })}</ul>
        <button className="outpost-primary" onClick={resume}>Back to exploring</button>
      </div> : showTraining && trainingMission && delivery ? <BaseSystems astronaut={astronaut.id} mission={trainingMission} location={nearbyBuilding(mission.position)} headingRef={panelHeading}
        onClose={resume} onComplete={finishTraining} />
      : showBase ? <BaseSystems astronaut={astronaut.id} location={nearbyBuilding(mission.position)} headingRef={panelHeading} onClose={resume} onStore={addStoredFood} /> : showScience ? <div className="building-info">
        <h2 ref={panelHeading} tabIndex={-1}>Moon science</h2>
        <p>The supplies use game points. Learn about <a href="https://www.nasa.gov/reference/moonbase-environment/" target="_blank" rel="noreferrer">Moon ice</a>, <a href="https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/" target="_blank" rel="noreferrer">plants in space</a> and <a href="https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/" target="_blank" rel="noreferrer">solar storm shelter</a> from NASA.</p>
        <button className="outpost-primary" onClick={resume}>Back to exploring</button>
      </div> : location && <div className="building-info">
        <h2 ref={panelHeading} tabIndex={-1}>{location.name}</h2>
        {opened === 'habitat' ? <>
          <p>Fill up your oxygen, water, food and power here.</p>
          <button className="outpost-primary" onClick={restock}>Refill supplies</button>
        </> : <p>{opened === 'horizon'
          ? delivery ? 'Complete all three missions to open this base.' : 'Welcome to your new Moon base!'
          : delivery ? `The crew needs you at ${delivery.name}.` : 'All missions complete. Explore the outpost!'}</p>}
        {!delivery && (opened === 'solar' || opened === 'greenhouse') && <button className="research-secondary" onClick={openBaseSystems}>Open base systems</button>}
        <button className="research-secondary" onClick={resume}>Back to exploring</button>
      </div>}
    </section>}
  </main>;
}
