import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import './launch.css';

const astronauts = [
  { id: 'nova', name: 'Nova', age: 9, color: '#c2a0ff', rgb: '194, 160, 255', suit: 'Purple', number: '01', position: '0%' },
  { id: 'leo', name: 'Leo', age: 10, color: '#7fbdff', rgb: '127, 189, 255', suit: 'Blue', number: '02', position: '33.3333%' },
  { id: 'maya', name: 'Maya', age: 8, color: '#ffbd84', rgb: '255, 189, 132', suit: 'Orange', number: '03', position: '66.6667%' },
  { id: 'kai', name: 'Kai', age: 11, color: '#7ee4cb', rgb: '126, 228, 203', suit: 'Teal', number: '04', position: '100%' },
];

function Rocket({ className }: { className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5c2.5-2.5 6-2 6-2s.5 3.5-2 6l-6.5 6.5-5-5L14 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="15.7" cy="7.3" r="1.7" stroke="currentColor" strokeWidth="1.5" /><path d="m7 10-3 .5-2 4 5 .5m6-1 1 5 4-2 .5-3M6.5 17.5l-3 3m3-6-2 2m5 1-2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function Star({ className }: { className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" fill="currentColor" /></svg>;
}

export default function App() {
  const [selected, setSelected] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const astronaut = astronauts[selected];

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

  return <div className="launch-page">
    <div className="space-backdrop" aria-hidden="true" />
    <div className="space-stars" aria-hidden="true" />
    <div className="orbit orbit-one" aria-hidden="true" />
    <div className="orbit orbit-two" aria-hidden="true" />

    <header className="launch-header">
      <a className="launch-logo" href="#launch-main" aria-label="LUNA-01 home"><span className="logo-orbit" aria-hidden="true"><Rocket /></span><span>LUNA<span className="logo-number">—01</span><small>BIG ADVENTURES. LITTLE ASTRONAUTS.</small></span></a>
      <div className="header-right"><button className="sound-button" onClick={() => setSoundOn(!soundOn)} aria-pressed={soundOn} aria-label={soundOn ? 'Turn selection sounds off' : 'Turn selection sounds on'} title={soundOn ? 'Sound on' : 'Sound off'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />{soundOn ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}</svg>
      </button></div>
    </header>

    <main className="launch-main" id="launch-main">
      <h1>The Moon is waiting.<br /><span>Who will you be?</span></h1>
      <p className="launch-intro">Pick your astronaut. Suit up. Let’s explore!</p>

      <section className="crew-section" aria-labelledby="crew-title">
        <div className="crew-heading"><span className="crew-line" /><h2 id="crew-title"><span>01</span> CHOOSE YOUR ASTRONAUT</h2><span className="crew-line" /></div>
        <div className="astronaut-grid" role="radiogroup" aria-label="Choose your astronaut" aria-describedby="crew-note">
          {astronauts.map((character, index) => <button type="button" key={character.id} role="radio" aria-checked={selected === index} aria-label={`${character.name}, age ${character.age}, ${character.suit.toLowerCase()} astronaut suit`} tabIndex={selected === index ? 0 : -1} ref={(element) => { radioRefs.current[index] = element; }} onKeyDown={(event) => handleRadioKey(event, index)} onClick={() => select(index)} className={`astronaut-card ${selected === index ? 'is-selected' : ''}`} style={{ '--suit': character.color, '--suit-rgb': character.rgb, '--sprite-position': character.position } as CSSProperties}>
            <span className="card-topline"><span>CADET {character.number}</span><span className="selection-check" aria-hidden="true">{selected === index ? '✓' : '+'}</span></span>
            <span className="astronaut-art" aria-hidden="true"><span className="character-halo" /><span className="character-sprite" /><span className="character-platform" /></span>
            <span className="character-info"><strong>{character.name}</strong><span className="character-age">AGE {character.age}</span></span>
            <span className="character-suit"><i /> {character.suit} suit <span className="selected-word">{selected === index ? 'SELECTED' : 'SELECT'}</span></span>
          </button>)}
        </div>
        <p className="crew-note" id="crew-note">Four explorers. One amazing adventure. You can be any of them.</p>
      </section>

      <div className="launch-actions">
        <p className="commander-message" role="status"><span className="ready-dot" /> Ready for liftoff, <strong>{astronaut.name}?</strong></p>
        <button className="start-game-button" disabled aria-describedby="mission-coming-soon"><Rocket /><span>Start game</span><span className="start-arrow" aria-hidden="true">→</span></button>
        <p className="launch-hint" id="mission-coming-soon">Mission coming soon. Pick your astronaut for now!</p>
      </div>

      <div className="mission-teasers" aria-label="Your adventure"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14A8 8 0 0 1 10 4 8 8 0 1 0 20 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg> Explore the Moon</span><i /><span><Star /> Make big decisions</span><i /><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> Keep your crew safe</span></div>
    </main>

    <footer className="launch-footer"><span>✦ A QUAD CORE ADVENTURE</span><span>MADE FOR THE NEXT GENERATION OF EXPLORERS</span><span>EARTH → MOON <span className="footer-orbit">◌</span></span></footer>
  </div>;
}
