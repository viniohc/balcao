export interface ReconnectSyncOptions {
  shouldRun: () => boolean
  sync: () => Promise<void>
  onFailure: (error: unknown) => void
}

export const createReconnectSyncController = ({ shouldRun, sync, onFailure }: ReconnectSyncOptions) => {
  let inFlight: Promise<void> | undefined

  const run = () => {
    if (inFlight) return inFlight
    if (!shouldRun()) return Promise.resolve()

    const operation = Promise.resolve()
      .then(sync)
      .catch((error: unknown) => {
        onFailure(error)
      })
      .finally(() => {
        if (inFlight === operation) inFlight = undefined
      })
    inFlight = operation
    return operation
  }

  return { run }
}
