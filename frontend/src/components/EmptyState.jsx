function EmptyState({ icon = '📭', title, body, action }) {
  return (
    <div className="bg-card border border-lightgray border-dashed px-6 py-10 text-center">
      <div className="text-[2.4rem] leading-none mb-3 opacity-60">{icon}</div>
      <h3 className="font-archivo font-extrabold text-[0.95rem] text-ink mb-1.5 tracking-tight">{title}</h3>
      {body && <p className="text-[0.82rem] text-gray max-w-[300px] mx-auto leading-relaxed mb-4">{body}</p>}
      {action}
    </div>
  )
}

export default EmptyState
