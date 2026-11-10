export type Resource = 'oxygen' | 'power' | 'food' | 'radiation';
export type ModuleId = 'habitat' | 'shelter' | 'greenhouse';
export type GameState = {
  day: number;
  oxygen: number;
  power: number;
  food: number;
  radiation: number;
  status: 'playing' | 'won' | 'lost';
};
export type Choice = {
  id: string;
  label: string;
  description: string;
  effects: Partial<Record<Resource, number>>;
};
export type Decision = {
  module: ModuleId;
  title: string;
  description: string;
  choices: Choice[];
};
export type Mission = {
  state: GameState;
  token: string;
  decision: Decision | null;
  feedback: string | null;
  reason: string | null;
};

async function request<T>(path: string, body: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Mission control is not responding. Check that the Rails API is running on port 3100, then try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? 'Mission control could not process that request. Please try again.');
  return data as T;
}

export const startMission = () => request<Mission>('/api/missions', {});
export const makeDecision = (token: string, actionId: string) =>
  request<Mission>('/api/missions/decision', { token, action_id: actionId });
