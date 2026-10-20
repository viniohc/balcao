import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import DemoSelect from '@/demo/DemoSelect.vue'

let mounted: App | undefined
const options = [
  { value: 'praca', label: 'Feira da Praça' },
  { value: 'garden', label: 'Festival do Jardim' },
  { value: 'disabled', label: 'Opção indisponível', disabled: true },
  { value: 'village', label: 'Sabores da Vila' },
]
const mount = async (disabled = false) => {
  const value = ref('praca')
  const host = document.createElement('div')
  document.body.append(host)
  mounted = createApp({ render: () => h(DemoSelect, { modelValue: value.value, options, label: 'Feira ativa', disabled, 'onUpdate:modelValue': next => { value.value = next } }) })
  mounted.mount(host)
  await nextTick()
  return { value, trigger: host.querySelector<HTMLButtonElement>('[role="combobox"]')! }
}
const key = async (trigger: HTMLElement, value: string) => {
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  await nextTick()
}
afterEach(() => { mounted?.unmount(); mounted = undefined; document.body.replaceChildren() })

describe('dropdown personalizado da demo', () => {
  it('expõe o valor, rótulo e seleção ao abrir e selecionar com ponteiro', async () => {
    const { value, trigger } = await mount()
    expect(trigger.getAttribute('aria-label')).toBe('Feira ativa')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click(); await nextTick()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="listbox"]')?.id).toBe(trigger.getAttribute('aria-controls'))
    expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Feira da Praça')
    document.querySelectorAll<HTMLElement>('[role="option"]')[1]!.click(); await nextTick()
    expect(value.value).toBe('garden')
    expect(trigger.textContent).toContain('Festival do Jardim')
    expect(document.querySelector('[role="listbox"]')).toBeNull()
  })
  it('navega sem mudar o valor até confirmar e ignora opções desabilitadas', async () => {
    const { value, trigger } = await mount()
    await key(trigger, 'ArrowDown'); await key(trigger, 'ArrowDown'); await key(trigger, 'ArrowDown')
    expect(value.value).toBe('praca')
    expect(document.querySelector('[data-active="true"]')?.textContent).toContain('Sabores da Vila')
    await key(trigger, 'Enter')
    expect(value.value).toBe('village')
    await key(trigger, 'Home'); await key(trigger, 'Enter')
    expect(value.value).toBe('praca')
    await key(trigger, 'End'); await key(trigger, 'Enter')
    expect(value.value).toBe('village')
  })
  it('encontra pelo texto e permite cancelar com Escape ou Tab', async () => {
    const { value, trigger } = await mount()
    await key(trigger, 'f'); await key(trigger, 'e'); await key(trigger, 's')
    expect(document.querySelector('[data-active="true"]')?.textContent).toContain('Festival do Jardim')
    await key(trigger, 'Escape')
    expect(value.value).toBe('praca')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await key(trigger, ' '); await key(trigger, 'Tab')
    expect(document.querySelector('[role="listbox"]')).toBeNull()
  })
  it('fecha ao clicar fora e não abre quando desabilitado', async () => {
    const { trigger } = await mount()
    trigger.click(); await nextTick()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); await nextTick()
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    mounted?.unmount(); mounted = undefined; document.body.replaceChildren()
    const disabled = await mount(true)
    disabled.trigger.click(); await nextTick()
    expect(disabled.trigger.disabled).toBe(true)
    expect(document.querySelector('[role="listbox"]')).toBeNull()
  })
})
