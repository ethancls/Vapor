import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function useInstances() {
  const queryClient = useQueryClient()
  const [wsInstances, setWsInstances] = useState(null)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/instances`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'instances') {
          setWsInstances(msg.data)
          queryClient.setQueryData(['instances'], { instances: msg.data })
        }
      } catch {}
    }

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [queryClient])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const query = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.getInstances(),
    refetchInterval: 10000,
  })

  const instances = wsInstances ?? query.data?.instances ?? []
  return { instances, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
