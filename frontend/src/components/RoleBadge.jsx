const ROLE_STYLES = {
  admin: { label: 'ADMIN', className: 'bg-[#8B1A1A] text-white' },
  moderator: { label: 'MOD', className: 'bg-navy text-gold' },
  developer: { label: 'DEV', className: 'bg-[#1A8A7D] text-white' },
}

function RoleBadge({ role, size = 'sm' }) {
  const config = ROLE_STYLES[role]
  if (!config) return null
  const padding = size === 'lg' ? 'py-[3px] px-2 text-[0.62rem]' : 'py-[1px] px-[5px] text-[0.55rem]'
  return (
    <span
      className={`font-archivo font-extrabold uppercase tracking-wider rounded-sm shrink-0 ${padding} ${config.className}`}
      title={`${role.charAt(0).toUpperCase()}${role.slice(1)}`}
    >
      {config.label}
    </span>
  )
}

export default RoleBadge
