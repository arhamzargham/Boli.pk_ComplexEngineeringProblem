"use client"

import { useEffect, useRef, useCallback } from 'react'

interface BidEvent {
  bidder_id: string
  amount_paisa: number
  auction_id: string
}

interface UseCentrifugoOptions {
  auctionId: string
  onBid: (event: BidEvent) => void
}

export function useCentrifugo({ auctionId, onBid }: UseCentrifugoOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const onBidRef = useRef(onBid)
  onBidRef.current = onBid

  const connect = useCallback(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8001'
    const ws = new WebSocket(`${wsUrl}/connection/websocket`)
    wsRef.current = ws

    ws.onopen = () => {
      // Centrifugo protocol: send connect command
      ws.send(JSON.stringify({
        id: 1,
        connect: { token: '', name: 'boli-frontend', version: '1.0.0' }
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>
        // After connect reply, subscribe to auction channel
        if (msg.id === 1 && msg.connect) {
          ws.send(JSON.stringify({
            id: 2,
            subscribe: { channel: `auction:${auctionId}` }
          }))
        }
        // Handle incoming publications
        const push = msg.push as Record<string, unknown> | undefined
        const pub  = push?.pub as Record<string, unknown> | undefined
        if (pub?.data) {
          onBidRef.current(pub.data as BidEvent)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      // Reconnect after 2 seconds
      setTimeout(connect, 2000)
    }
  }, [auctionId])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])
}
