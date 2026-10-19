import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const

// The bottom of the chain: the classifier answers `label`, prompts enter as typed,
// and each model request records the model it was sent to.
const world = (on: On, label: string | Error) => {
  const sent: string[] = []
  on('model.classify', () => {
    if (label instanceof Error) throw label
    return { value: label }
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.step', async function* ($, e) {
    sent.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return sent
}

const submit = ($: Engine, text: string) => $.prompt.submit({ text } as never)

const step = async ($: Engine, agentId?: string) => {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId })
  for await (const _ of stream) {
    // drain
  }
  return stream.result
}

describe('routing', () => {
  test('a simple prompt goes to Haiku', async ($, on) => {
    const sent = world(on, 'simple')
    await submit($, 'hola, ¿qué hora es?')
    await step($)
    expect(sent).toEqual(['claude-haiku-5-5'])
  })

  test('a complex prompt goes to Opus', async ($, on) => {
    const sent = world(on, 'complex')
    await submit($, 'Rediseña la arquitectura del módulo de pagos')
    await step($)
    expect(sent).toEqual(['claude-opus-5-5'])
  })

  test('a failed classifier falls back to the estimate', async ($, on) => {
    const sent = world(on, new Error('offline'))
    await submit($, 'Refactoriza todo el backend')
    await step($)
    expect(sent).toEqual(['claude-opus-5-5'])
  })

  test('subagents keep their own model', async ($, on) => {
    const sent = world(on, 'simple')
    await submit($, 'hola')
    await step($, 'agent-1')
    expect(sent).toEqual(['claude-sonnet-5-5'])
  })

  test('/router opus pins the model', async ($, on) => {
    const sent = world(on, 'simple')
    await $.command.run({ command: 'router', args: 'opus' } as never)
    await submit($, 'hola')
    await step($)
    expect(sent).toEqual(['claude-opus-5-5'])
  })
})

describe('band', () => {
  for (const surface of SURFACES) {
    test(`shows the chosen model on ${surface}`, async ($, on) => {
      world(on, 'complex')
      await submit($, 'Diseña un sistema distribuido')
      const ui = await $.ui.mount({
        plugin: 'model-router',
        surface,
        component: 'AbovePrompt',
        props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 } as never,
      })
      expect((await ui.findAll({ text: /Opus/ })).length).toBeGreaterThan(0)
      expect((await ui.findAll({ text: /tarea compleja/ })).length).toBeGreaterThan(0)
      expect((await ui.findAll({ text: /elegido a mano/ })).length).toBe(0)

      await ui.press({ key: 'mode-haiku' })
      expect((await ui.findAll({ text: /elegido a mano/ })).length).toBeGreaterThan(0)
    })
  }
})
