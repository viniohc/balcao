import { describe, expect, it, vi } from 'vitest'
import { createReconnectSyncController } from '@/services/reconnectSync'

describe('reconnect sync controller', () => {
  it('starts one automatic sync for repeated reconnect events while it is running', async () => {
    let releaseSync: (() => void) | undefined
    const sync = vi.fn(() => new Promise<void>((resolve) => {
      releaseSync = resolve
    }))
    const controller = createReconnectSyncController({
      shouldRun: () => true,
      sync,
      onFailure: vi.fn(),
    })

    const first = controller.run()
    const second = controller.run()
    expect(second).toBe(first)
    await Promise.resolve()
    expect(sync).toHaveBeenCalledTimes(1)

    releaseSync?.()
    await Promise.all([first, second])
    sync.mockResolvedValue(undefined)
    await controller.run()
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('keeps failure visible and allows a later reconnect retry', async () => {
    const failure = new Error('synthetic offline')
    const onFailure = vi.fn()
    const sync = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined)
    const controller = createReconnectSyncController({
      shouldRun: () => true,
      sync,
      onFailure,
    })

    await controller.run()
    expect(onFailure).toHaveBeenCalledWith(failure)
    await controller.run()
    expect(sync).toHaveBeenCalledTimes(2)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it('does not start a sync when there is no online session', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const controller = createReconnectSyncController({
      shouldRun: () => false,
      sync,
      onFailure: vi.fn(),
    })

    await controller.run()
    expect(sync).not.toHaveBeenCalled()
  })
})
