// Agent identity contract. These ids, persona paths and memory paths are FIXED
// and must match the markdown files written by the other worker exactly.

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  personaPath: string; // relative to repo root
  memoryPath: string; // relative to repo root
  /** Whether this agent runs in the daily tick (audit/regulator do not). */
  daily: boolean;
}

export const AGENTS: Record<string, AgentIdentity> = {
  ceo: {
    id: 'ceo',
    name: 'Graham',
    role: 'CEO',
    personaPath: 'sim/agents/ceo.md',
    memoryPath: 'sim/memory/ceo.memory.md',
    daily: true,
  },
  sales: {
    id: 'sales',
    name: 'Tony',
    role: 'Sales Director',
    personaPath: 'sim/agents/sales.md',
    memoryPath: 'sim/memory/sales.memory.md',
    daily: true,
  },
  cfo: {
    id: 'cfo',
    name: 'Janet',
    role: 'CFO',
    personaPath: 'sim/agents/cfo.md',
    memoryPath: 'sim/memory/cfo.memory.md',
    daily: true,
  },
  comms: {
    id: 'comms',
    name: 'Priya',
    role: 'Comms',
    personaPath: 'sim/agents/comms.md',
    memoryPath: 'sim/memory/comms.memory.md',
    daily: true,
  },
  'middle-manager': {
    id: 'middle-manager',
    name: 'Keith',
    role: 'Middle Manager',
    personaPath: 'sim/agents/middle-manager.md',
    memoryPath: 'sim/memory/middle-manager.memory.md',
    daily: true,
  },
  audit: {
    id: 'audit',
    name: 'Derek',
    role: 'Internal Audit',
    personaPath: 'sim/agents/audit.md',
    memoryPath: 'sim/memory/audit.memory.md',
    daily: false, // weekly audit tick only
  },
  regulator: {
    id: 'regulator',
    name: 'Regulator',
    role: 'Regulator',
    personaPath: 'sim/agents/regulator.md',
    memoryPath: 'sim/memory/regulator.memory.md',
    daily: false, // separate probabilistic cron
  },
};

/** Look up an agent by id; throws on unknown ids (they are a programmer error). */
export function getAgent(id: string): AgentIdentity {
  const agent = AGENTS[id];
  if (!agent) throw new Error(`Unknown agent id '${id}'.`);
  return agent;
}

/** The agents the daily tick runs, IN ORDER (build-spec §4). */
export const DAILY_AGENT_ORDER: string[] = [
  'ceo',
  'sales',
  'cfo',
  'comms',
  'middle-manager',
];
