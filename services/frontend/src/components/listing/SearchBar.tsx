'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

interface Props {
  initialQuery?: string
}

export default function SearchBar({ initialQuery }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery ?? '')

  function handleSearch() {
    const q = query.trim()
    router.push(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }

  return (
    <div className="flex gap-2 mt-5 max-w-[520px]">
      <div className="flex flex-1 bg-white/8 border border-copper/25 rounded-[9px] overflow-hidden focus-within:border-copper/60 transition-colors">
        <Search size={14} className="text-white/40 ml-3 my-auto flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search iPhone, Samsung, Pixel, OnePlus…"
          className="flex-1 bg-transparent px-2.5 py-2.5 text-[13px] text-white placeholder-white/35 focus:outline-none"
        />
      </div>
      <button
        onClick={handleSearch}
        className="bg-copper text-white text-[13px] px-5 rounded-[9px] hover:bg-copper/90 transition-colors flex-shrink-0"
      >
        Search
      </button>
    </div>
  )
}
