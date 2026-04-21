const CONTACTS = [
  {
    label: 'Campus Police (Emergency)',
    value: '443-885-3103',
    href: 'tel:+14438853103',
    priority: true,
  },
  {
    label: 'Campus Police (Non-Emergency)',
    value: '443-885-3125',
    href: 'tel:+14438853125',
  },
  {
    label: 'Safety Escort (after dark)',
    value: '443-885-3103',
    href: 'tel:+14438853103',
  },
  {
    label: 'Title IX Office',
    value: 'titleix@morgan.edu',
    href: 'mailto:titleix@morgan.edu',
  },
  {
    label: 'Counseling Center (24/7)',
    value: '443-885-3130',
    href: 'tel:+14438853130',
  },
]

function SafetyBox({ onReportIncident }) {
  return (
    <div className="border border-lightgray bg-card mb-3.5 overflow-hidden" id="safety">
      <div className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest px-4 py-3 bg-[#8B1A1A] text-white flex items-center gap-2">
        <span aria-hidden="true">&#128680;</span>
        Campus Safety
      </div>
      {CONTACTS.map((c) => (
        <a
          key={c.label}
          href={c.href}
          className="flex items-center justify-between px-4 py-2.5 border-b border-[#EAE7E0] last:border-b-0 no-underline text-ink hover:bg-offwhite transition-colors group/safety"
        >
          <div className="min-w-0">
            <div className="text-[0.72rem] text-gray">{c.label}</div>
            <div className={`text-[0.82rem] font-archivo font-bold truncate ${c.priority ? 'text-[#8B1A1A]' : 'text-ink'}`}>
              {c.value}
            </div>
          </div>
          <span className="font-archivo text-[0.55rem] font-extrabold uppercase tracking-widest text-gray group-hover/safety:text-navy shrink-0 ml-2">
            {c.href.startsWith('tel:') ? 'Call' : 'Email'}
          </span>
        </a>
      ))}
      {onReportIncident && (
        <button
          onClick={onReportIncident}
          className="w-full bg-navy text-gold font-archivo font-extrabold text-[0.7rem] uppercase tracking-wider py-3 border-none cursor-pointer hover:bg-[#0a182b] transition-colors flex items-center justify-center gap-2"
        >
          <span aria-hidden="true">&#128373;</span>
          Report anonymously
        </button>
      )}
    </div>
  )
}

export default SafetyBox
