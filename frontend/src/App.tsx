import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import './launch.css';
import MissionBriefing from './MissionBriefing';
import { parseRoute } from './navigation';
import MoonOutpost, { preloadOutpostScene } from './MoonOutpost';

const astronauts = [
  { id: 'nova', name: 'Nova', age: 9, color: '#c2a0ff', rgb: '194, 160, 255', suit: 'Purple', position: '0%' },
  { id: 'leo', name: 'Leo', age: 10, color: '#7fbdff', rgb: '127, 189, 255', suit: 'Blue', position: '33.3333%' },
  { id: 'maya', name: 'Maya', age: 8, color: '#ffbd84', rgb: '255, 189, 132', suit: 'Orange', position: '66.6667%' },
  { id: 'kai', name: 'Kai', age: 11, color: '#7ee4cb', rgb: '126, 228, 203', suit: 'Teal', position: '100%' },
];

function Rocket({ className }: { className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5c2.5-2.5 6-2 6-2s.5 3.5-2 6l-6.5 6.5-5-5L14 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="15.7" cy="7.3" r="1.7" stroke="currentColor" strokeWidth="1.5" /><path d="m7 10-3 .5-2 4 5 .5m6-1 1 5 4-2 .5-3M6.5 17.5l-3 3m3-6-2 2m5 1-2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function readRoute() {
  return parseRoute(window.location.pathname, window.location.hash);
}

export default function App() {
  const [selected, setSelected] = useState(() => readRoute().selected ?? 0);
  const [page, setPage] = useState<'selection' | 'briefing' | 'outpost'>(() => readRoute().page);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [soundOn, setSoundOn] = useState(false);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const astronaut = astronauts[selected];

  useEffect(() => {
    const followRoute = () => {
      const route = readRoute();
      if (route.selected !== null) setSelected(route.selected);
      setPage(route.page);
    };
    window.addEventListener('hashchange', followRoute);
    window.addEventListener('popstate', followRoute);
    return () => {
      window.removeEventListener('hashchange', followRoute);
      window.removeEventListener('popstate', followRoute);
    };
  }, []);

  useEffect(() => {
    if (page === 'briefing') void preloadOutpostScene().catch(() => {});
  }, [page]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'instant' });
    headingRef.current?.focus({ preventScroll: true });
  }, [page]);

  function playTone() {
    if (!soundOn) return;
    try {
      const context = audio.current ?? (audio.current = new AudioContext());
      void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(990, context.currentTime + .12);
      gain.gain.setValueAtTime(.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .2);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + .2);
    } catch { /* Selection still works when audio is unavailable. */ }
  }

  function openMission(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    playTone();
    window.history.pushState(null, '', event.currentTarget.href);
    setPage('outpost');
  }

  function select(index: number) {
    setSelected(index);
    playTone();
  }

  function handleRadioKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % astronauts.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + astronauts.length - 1) % astronauts.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = astronauts.length - 1;
    else return;
    event.preventDefault();
    select(next);
    radioRefs.current[next]?.focus();
  }

  return <div className={page === 'outpost' ? 'launch-page game-screen' : 'launch-page'}>
    <div className="space-backdrop" aria-hidden="true" />
    <div className="space-stars" aria-hidden="true" />
    <div className="orbit orbit-one" aria-hidden="true" />
    <div className="orbit orbit-two" aria-hidden="true" />

    <header className="launch-header">
      <a className="launch-logo" href="#launch-main" aria-label="LUNA-01 home"><span className="logo-orbit" aria-hidden="true"><Rocket /></span><span>LUNA<span className="logo-number">—01</span></span></a>
      <div className="header-right"><button className="sound-button" onClick={() => setSoundOn(!soundOn)} aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'} title={soundOn ? 'Sound on' : 'Sound off'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />{soundOn ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}</svg>
      </button></div>
    </header>

    {page === 'outpost' ? <MoonOutpost key={astronaut.id} astronaut={astronaut} headingRef={headingRef} onSound={playTone} /> : page === 'briefing' ? <MissionBriefing astronaut={astronaut} headingRef={headingRef} onStart={openMission} /> : <main className="launch-main" id="launch-main">
      <h1 ref={headingRef} tabIndex={-1}>Pick your <span>astronaut</span></h1>
      <div className="astronaut-grid" role="radiogroup" aria-label="Pick your astronaut">
        {astronauts.map((character, index) => <button type="button" key={character.id} role="radio" aria-checked={selected === index} aria-label={`${character.name}, age ${character.age}, ${character.suit.toLowerCase()} astronaut suit`} tabIndex={selected === index ? 0 : -1} ref={(element) => { radioRefs.current[index] = element; }} onKeyDown={(event) => handleRadioKey(event, index)} onClick={() => select(index)} className={`astronaut-card ${selected === index ? 'is-selected' : ''}`} style={{ '--suit': character.color, '--suit-rgb': character.rgb, '--sprite-position': character.position } as CSSProperties}>
          {selected === index && <span className="selection-check" aria-hidden="true">✓</span>}
          <span className="astronaut-art" aria-hidden="true"><span className="character-halo" /><span className="character-sprite" /><span className="character-platform" /></span>
          <span className="character-info"><strong>{character.name}</strong><span className="character-age">Age {character.age}</span></span>
        </button>)}
      </div>
      <button className="start-game-button" onClick={() => { playTone(); window.location.hash = `briefing/${astronaut.id}`; }}>
        Next <span aria-hidden="true">→</span>
      </button>
    </main>}
  </div>;
}
