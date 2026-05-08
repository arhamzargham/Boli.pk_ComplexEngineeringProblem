'use client'

import { useState, useEffect, useRef } from 'react'
import { auctionCountdown } from '@/lib/formatters'

interface Props {
  endTime: string
  size?: 'sm' | 'lg'
  onEnd?: () => void
}

export default function CountdownTimer({ endTime, size = 'sm', onEnd }: Props) {
  const [display, setDisplay] = useState(() => auctionCountdown(endTime))
  const endedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    const tick = () => {
      const val = auctionCountdown(endTime)
      setDisplay(val)
      if (val === 'Ended' && !endedRef.current) {
        endedRef.current = true
        onEndRef.current?.()
      }
    }
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endTime])

  const ended = display === 'Ended'

  if (size === 'sm') {
    return (
      <span className={`text-[11px] font-mono font-medium ${ended ? 'text-danger' : 'text-copper'}`}>
        {display}
      </span>
    )
  }

  // lg — parse "02h 14m 38s" into [hh, mm, ss]
  let parts: [string, string, string] = ['00', '00', '00']
  if (!ended) {
    const m = display.match(/(\d+)h\s+(\d+)m\s+(\d+)s/)
    if (m) parts = [m[1], m[2], m[3]]
  }

  const blockCls = `min-w-[52px] h-[52px] rounded-xl flex items-center justify-center ${ended ? 'bg-danger/10' : 'bg-obs'}`
  const numCls = `font-mono text-[22px] font-semibold ${ended ? 'text-danger' : 'text-white'}`

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className={blockCls}><span className={numCls}>{parts[0]}</span></div>
        <span className="text-[18px] text-text-faint font-mono">:</span>
        <div className={blockCls}><span className={numCls}>{parts[1]}</span></div>
        <span className="text-[18px] text-text-faint font-mono">:</span>
        <div className={blockCls}><span className={numCls}>{parts[2]}</span></div>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <div className="min-w-[52px] text-center"><span className="text-[8px] text-text-faint">HRS</span></div>
        <span className="invisible text-[18px] font-mono">:</span>
        <div className="min-w-[52px] text-center"><span className="text-[8px] text-text-faint">MIN</span></div>
        <span className="invisible text-[18px] font-mono">:</span>
        <div className="min-w-[52px] text-center"><span className="text-[8px] text-text-faint">SEC</span></div>
      </div>
    </div>
  )
}
