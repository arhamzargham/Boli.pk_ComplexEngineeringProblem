const STATS = [
  { value: '2,847',  label: 'Transactions settled',   highlight: true  },
  { value: 'Rs. 0',  label: 'Fraud losses to date',   highlight: false },
  { value: '98.4%',  label: 'Settlement success rate', highlight: false },
  { value: '6-point',label: 'AI vetting pipeline',    highlight: false },
  { value: '< 5s',   label: 'Avg vetting time',       highlight: false },
]

export default function StatsBar() {
  return (
    <div className="bg-obs border-t border-white/5">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-3 md:grid-cols-5 divide-x divide-white/[0.07]">
          {STATS.map(stat => (
            <div key={stat.label} className="py-3 px-4 text-center">
              <div className={`text-[17px] font-medium font-mono ${stat.highlight ? 'text-copper' : 'text-white'}`}>
                {stat.value}
              </div>
              <div className="text-[9px] text-white/40 mt-0.5 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
