import { useEffect, useState } from 'react'
import { checkModelServerHealth } from '#/services/modelServer'

export type ServerStatus = 'checking' | 'up' | 'down'

interface UseServerStatusOptions {
  intervalMs?: number
}

export function useServerStatus(
  options: UseServerStatusOptions = {},
): ServerStatus {
  const { intervalMs = 10000 } = options
  const [status, setStatus] = useState<ServerStatus>('checking')

  useEffect(() => {
    let mounted = true

    const refreshHealth = async () => {
      const isHealthy = await checkModelServerHealth()
      if (!mounted) return
      setStatus(isHealthy ? 'up' : 'down')
    }

    void refreshHealth()
    const timer = window.setInterval(() => {
      void refreshHealth()
    }, intervalMs)

    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [intervalMs])

  return status
}
