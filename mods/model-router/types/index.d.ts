export type Tier = 'haiku' | 'sonnet' | 'opus'
export type Mode = 'auto' | Tier
export type Decision = {
  tier: Tier
  reason: string
  isPending: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'model-router': { mode: Mode; decision: Decision | null }
  }
}
