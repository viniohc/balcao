<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import DemoIcon from '@/demo/DemoIcon.vue'

interface Option { value: string; label: string; description?: string; disabled?: boolean }
const props = withDefaults(defineProps<{
  modelValue: string
  options: Option[]
  label: string
  disabled?: boolean
  placeholder?: string
}>(), { disabled: false, placeholder: 'Selecione uma opção' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const uid = useId()
const listId = 'demo-options-' + uid
const trigger = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const open = ref(false)
const activeIndex = ref(-1)
const menuStyle = ref<Record<string, string>>({})
const selected = computed(() => props.options.find(option => option.value === props.modelValue))
const unavailable = computed(() => props.disabled || !props.options.some(option => !option.disabled))
const activeId = computed(() => open.value && activeIndex.value >= 0 ? listId + '-' + activeIndex.value : undefined)
let search = ''
let searchTimer: ReturnType<typeof setTimeout> | undefined

const close = () => { open.value = false; search = ''; clearTimeout(searchTimer) }
const placeMenu = () => {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, 248), window.innerWidth - 32)
  const below = window.innerHeight - rect.bottom - 16
  const above = rect.top - 16
  const useAbove = below < Math.min(props.options.length * 52 + 44, 280) && above > below
  menuStyle.value = {
    width: width + 'px',
    left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)) + 'px',
    maxHeight: Math.max(88, Math.min(320, useAbove ? above : below)) + 'px',
    ...(useAbove ? { bottom: window.innerHeight - rect.top + 8 + 'px' } : { top: rect.bottom + 8 + 'px' }),
  }
}
const revealActive = () => nextTick(() => menu.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' }))
const show = async (edge?: 'first' | 'last') => {
  if (unavailable.value) return
  const enabled = props.options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
  const current = props.options.findIndex(option => option.value === props.modelValue && !option.disabled)
  activeIndex.value = edge === 'last' ? enabled[enabled.length - 1]! : edge === 'first' ? enabled[0]! : current >= 0 ? current : enabled[0]!
  placeMenu()
  open.value = true
  await revealActive()
}
const choose = (index: number) => {
  const option = props.options[index]
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  close()
  void nextTick(() => trigger.value?.focus({ preventScroll: true }))
}
const move = (direction: number) => {
  for (let count = 0; count < props.options.length; count++) {
    activeIndex.value = (activeIndex.value + direction + props.options.length) % props.options.length
    if (!props.options[activeIndex.value]?.disabled) break
  }
  void revealActive()
}
const onKey = (event: KeyboardEvent) => {
  if (unavailable.value) return
  if (event.key === 'Tab') { close(); return }
  if (event.key === 'Escape') { if (open.value) { event.preventDefault(); event.stopPropagation(); close() } return }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    if (event.key === 'Home' || event.key === 'End') { void show(event.key === 'Home' ? 'first' : 'last'); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!open.value) void show()
      else move(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (open.value) choose(activeIndex.value)
    else void show()
    return
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    if (!open.value) void show()
    clearTimeout(searchTimer)
    search += event.key.toLocaleLowerCase('pt-BR')
    const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    const query = normalized(search)
    const match = props.options.findIndex(option => !option.disabled && normalized(option.label).startsWith(query))
    if (match >= 0) { activeIndex.value = match; void revealActive() }
    searchTimer = setTimeout(() => { search = '' }, 700)
  }
}
const outside = (event: PointerEvent) => {
  const target = event.target as Node
  if (!trigger.value?.contains(target) && !menu.value?.contains(target)) close()
}
const onScroll = (event: Event) => { if (!menu.value?.contains(event.target as Node)) close() }
watch(() => props.modelValue, () => { if (open.value) activeIndex.value = props.options.findIndex(option => option.value === props.modelValue) })
watch(unavailable, value => { if (value) close() })
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, true)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div class="demo-select" :class="{ 'is-open': open }">
    <button ref="trigger" type="button" class="demo-select-trigger" role="combobox" aria-haspopup="listbox"
      :aria-label="label" :aria-expanded="open" :aria-controls="listId" :aria-activedescendant="activeId"
      :disabled="unavailable" @click="open ? close() : show()" @keydown="onKey" @blur="close">
      <span class="select-value">{{ selected?.label ?? placeholder }}</span><DemoIcon name="chevron" />
    </button>
    <Teleport to="body">
      <div v-if="open" :id="listId" ref="menu" class="demo-select-menu" role="listbox" :aria-label="label" :style="menuStyle" @pointerdown.prevent>
        <div class="select-menu-caption" aria-hidden="true">{{ label }}</div>
        <div v-for="(option, index) in options" :id="listId + '-' + index" :key="option.value" class="demo-select-option"
          role="option" :aria-selected="option.value === modelValue" :aria-disabled="option.disabled || undefined"
          :data-active="index === activeIndex" @pointermove="!option.disabled && (activeIndex = index)" @click="choose(index)">
          <span><strong>{{ option.label }}</strong><span v-if="option.description" class="select-option-description">{{ option.description }}</span></span>
          <DemoIcon v-if="option.value === modelValue" name="check" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
