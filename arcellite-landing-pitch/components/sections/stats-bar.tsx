const stats = [
  { value: "$0", label: "Monthly fees" },
  { value: "100%", label: "Data ownership" },
  { value: "< 2 min", label: "Setup time" },
  { value: "MIT", label: "Open license" },
]

export function StatsBar() {
  return (
    <section className="bg-[#f5f5f7] border-y border-gray-200">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center py-8 px-4 gap-1">
              <span className="font-heading font-bold text-3xl md:text-4xl text-[#1d1d1f]">
                {stat.value}
              </span>
              <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
