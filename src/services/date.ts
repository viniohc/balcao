export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'

const dateKeyFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRAZIL_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

export const isDateKey = (value: string) => dateKeyPattern.test(value)

const parseDate = (date: string | Date) => {
  if (typeof date === 'string' && isDateKey(date)) {
    return new Date(`${date}T12:00:00.000Z`)
  }

  return new Date(date)
}

export const getDateKey = (date: string | Date = new Date()) => {
  const parts = dateKeyFormat.formatToParts(parseDate(date))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

export const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseDate(date))

export const formatTime = (date: string | Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(parseDate(date))

export const todayLabel = () =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date())
