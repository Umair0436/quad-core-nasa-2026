import type { CSSProperties, MouseEventHandler, RefObject } from 'react';
import './briefing.css';

export type Astronaut = {
  id: string;
  name: string;
  age: number;
  color: string;
  rgb: string;
  suit: string;
  position: string;
};

export default function MissionBriefing({ astronaut, headingRef, onStart }: {
  astronaut: Astronaut;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onStart: MouseEventHandler<HTMLAnchorElement>;
}) {
  const portraitStyle = {
    '--suit': astronaut.color,
    '--suit-rgb': astronaut.rgb,
    '--sprite-position': astronaut.position,
  } as CSSProperties;

  return <main className="briefing-main" id="briefing-main">
    <section className="briefing-welcome" aria-labelledby="briefing-title">
      <div className="briefing-portrait" style={portraitStyle}>
        <div className="portrait-sprite" role="img" aria-label={`${astronaut.name} in a ${astronaut.suit.toLowerCase()} spacesuit`} />
      </div>
      <div className="briefing-welcome-copy">
        <h1 id="briefing-title" ref={headingRef} tabIndex={-1}><span>{astronaut.name}</span>, let’s go!</h1>
        <p>Find clues. Help your Moon base.</p>
        <ol className="briefing-days">
          <li>Keep your supplies topped up.</li>
          <li>Pick up a science note.</li>
          <li>Bring it to the lab for an upgrade.</li>
        </ol>
        <a className="start-game-button" href={`/outpost/${astronaut.id}`} onClick={onStart}>Start mission <span aria-hidden="true">→</span></a>
        <a className="change-astronaut" href="#launch-main">← Pick someone else</a>
      </div>
    </section>
  </main>;
}
