const astronautIds = ['nova', 'leo', 'maya', 'kai'] as const;
export type AstronautId = typeof astronautIds[number];
export type Page = 'selection' | 'briefing' | 'outpost';
export type Route = { page: Page; selected: number | null };

// Keep existing bookmarked hash routes working alongside direct page URLs.
export function parseRoute(pathname: string, hash: string): Route {
  if (hash === '#launch-main') return { page: 'selection', selected: null };
  const fragment = /^#\/?(briefing|outpost)\/(nova|leo|maya|kai)\/?$/.exec(hash);
  const path = /^\/(briefing|outpost)\/(nova|leo|maya|kai)\/?$/.exec(pathname);
  const match = fragment ?? path;
  if (!match) return { page: 'selection', selected: null };
  return {
    page: match[1] as 'briefing' | 'outpost',
    selected: astronautIds.indexOf(match[2] as AstronautId),
  };
}
