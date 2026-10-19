import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Decision, Mode, Tier } from '../types'

const mode = atom({ plugin: 'model-router', key: 'mode' } as const, 'auto')
const decision = atom({ plugin: 'model-router', key: 'decision' } as const, null)

const MODELS: Record<Tier, { id: string; name: string; cost: string; color: string }> = {
  haiku: { id: 'claude-haiku-5-5', name: 'Haiku', cost: '$', color: 'success' },
  sonnet: { id: 'claude-sonnet-5-5', name: 'Sonnet', cost: '$$', color: 'suggestion' },
  opus: { id: 'claude-opus-5-5', name: 'Opus', cost: '$$$', color: 'claude' },
}
const TIERS: readonly Tier[] = ['haiku', 'sonnet', 'opus']

// The band above the prompt is drawn on the terminal and desktop only; elsewhere
// (the mobile app, the editor) the same view goes in a pane.
const PANE = 'model-router'
const HAS_BAND: readonly RenderSurface[] = ['terminal', 'desktop']
const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Model router' })

const LABELS = ['simple', 'moderate', 'complex'] as const
const TIER_OF: Record<(typeof LABELS)[number], Tier> = {
  simple: 'haiku',
  moderate: 'sonnet',
  complex: 'opus',
}
const REASON_OF: Record<Tier, string> = {
  haiku: 'tarea simple',
  sonnet: 'tarea moderada',
  opus: 'tarea compleja',
}

const framed = (text: string) =>
  [
    'Rate how much reasoning a coding assistant needs for this request.',
    'simple: a quick question, a greeting, a typo, a one-line change, reading or listing something.',
    'moderate: a normal feature, a bug fix in a few files, a script, an explanation of code.',
    'complex: architecture, a large refactor, a hard bug, multi-step planning, security or performance work.',
    '',
    'Request:',
    text.slice(0, 4000),
  ].join('\n')

// Used when the classifier call fails: length and a few keywords.
const guess = (text: string): Tier => {
  const hard = /arquitect|refactor|diseñ|migra|seguridad|rendimiento|optimiz|debug|architect|design|security|performance/i
  if (hard.test(text) || text.length > 1200) return 'opus'
  if (text.length < 80) return 'haiku'
  return 'sonnet'
}

const show = async ($: EngineInterface, next: Decision) => {
  await update($, decision, () => next)
  const model = MODELS[next.tier]
  $.ui.status(next.isPending ? 'Router: analizando…' : `Router: ${model.name} ${model.cost} · ${next.reason}`)
}

const setMode = async ($: EngineInterface, next: Mode) => {
  await update($, mode, () => next)
  if (next !== 'auto') {
    await show($, { tier: next, reason: 'elegido a mano', isPending: false })
  }
}

const view = async ($: EngineInterface, { Box, Button, Text }: Elements[RenderSurface]) => {
  const current = await read($, mode)
  const chosen = await read($, decision)

  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text bold>Modelo</Text>
        {TIERS.map(tier => {
          const model = MODELS[tier]
          const isChosen = chosen !== null && !chosen.isPending && chosen.tier === tier
          return isChosen ? (
            <Text bold color="inverseText" backgroundColor={model.color}>
              {' '}
              {model.name} {model.cost}{' '}
            </Text>
          ) : (
            <Text dimColor>
              {' '}
              {model.name} {model.cost}{' '}
            </Text>
          )
        })}
        <Text dimColor={chosen === null || chosen.isPending}>
          {chosen === null ? 'esperando prompt' : chosen.isPending ? 'analizando…' : chosen.reason}
        </Text>
      </Box>
      <Box columnGap={1}>
        <Text dimColor>Modo</Text>
        <Button
          key="mode-auto"
          plain
          variant={current === 'auto' ? 'primary' : 'secondary'}
          onPress={() => setMode($, 'auto')}
        >
          {current === 'auto' ? '● Auto' : '○ Auto'}
        </Button>
        {TIERS.map(tier => (
          <Button
            key={`mode-${tier}`}
            plain
            variant={current === tier ? 'primary' : 'secondary'}
            onPress={() => setMode($, tier)}
          >
            {current === tier ? '●' : '○'} {MODELS[tier].name}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  // Surfaces the band has been drawn on. A host may attach a surface and never
  // ask for the band; then the pane is opened instead.
  const bandDrawnOn = new Set<RenderSurface>()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Router de modelos: auto, haiku, sonnet u opus',
      argumentHint: 'auto|haiku|sonnet|opus',
    })
    const surfaces = await $.session.surfaces()
    if (surfaces.some(surface => !HAS_BAND.includes(surface))) {
      void openPane($)
    }

    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    if (!HAS_BAND.includes(e.surface)) {
      void openPane($)
    }

    return next(e)
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    const asked = e.args.trim().toLowerCase()
    if (asked === 'auto' || (TIERS as readonly string[]).includes(asked)) {
      await setMode($, asked as Mode)
      return { text: asked === 'auto' ? 'Router en automático.' : `Router fijado en ${MODELS[asked as Tier].name}.` }
    }
    const opened = await openPane($)
    const current = await read($, mode)
    const surfaces = await $.session.surfaces()
    const where = [
      `superficies: ${surfaces.length === 0 ? 'ninguna' : surfaces.join(', ')}`,
      `banda dibujada en: ${bandDrawnOn.size === 0 ? 'ninguna' : [...bandDrawnOn].join(', ')}`,
      `panel: ${opened.isPlaced ? 'abierto' : `sin colocar (${opened.reason})`}`,
    ].join(' · ')
    return { text: `Router: ${current}. Uso: /router auto|haiku|sonnet|opus\n${where}` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.isMeta || e.text.trim() === '') {
      return next(e)
    }
    if ((await read($, mode)) !== 'auto') {
      return next(e)
    }

    await show($, { tier: 'sonnet', reason: 'analizando…', isPending: true })
    let tier: Tier
    let reason: string
    try {
      const label = await $.model.classify(framed(e.text), LABELS, { model: 'haiku' })
      tier = label === undefined ? guess(e.text) : TIER_OF[label as (typeof LABELS)[number]]
      reason = REASON_OF[tier]
    } catch {
      tier = guess(e.text)
      reason = `${REASON_OF[tier]} (estimado)`
    }
    await show($, { tier, reason, isPending: false })
    if (bandDrawnOn.size === 0) {
      // With no surface attached (a cloud session) nothing can be drawn: say it in the transcript.
      if ((await $.session.surfaces()).length === 0) {
        $.ui.log(`Router: ${MODELS[tier].name} ${MODELS[tier].cost} · ${reason}`)
      } else {
        void openPane($)
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Every model request of the main loop goes to the chosen model; subagents keep theirs.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      return yield* next(e)
    }
    const chosen = await read($, decision)
    if (chosen === null || chosen.isPending) {
      return yield* next(e)
    }

    return yield* next({ ...e, model: MODELS[chosen.tier].id })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    bandDrawnOn.add(e.surface)
    if (e.props.hasSurvey) {
      return next(e)
    }
    return view($, $.ui.resolve(e))
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => view($, $.ui.resolve(e)))
}
