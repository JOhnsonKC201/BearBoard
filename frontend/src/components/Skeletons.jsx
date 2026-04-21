export function PostCardSkeleton() {
  return (
    <div className="bg-card border border-lightgray border-l-[3px] border-l-lightgray mb-2.5 px-[18px] py-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="skeleton w-8 h-8 rounded-[3px]" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-[10px] w-[120px]" />
          <div className="skeleton h-[8px] w-[80px]" />
        </div>
        <div className="skeleton h-[16px] w-[60px] rounded-sm" />
      </div>
      <div className="skeleton h-[14px] w-[85%] mb-2" />
      <div className="space-y-1.5 mb-3">
        <div className="skeleton h-[10px] w-full" />
        <div className="skeleton h-[10px] w-[92%]" />
        <div className="skeleton h-[10px] w-[60%]" />
      </div>
      <div className="flex items-center gap-3 pt-2 border-t border-[#EAE7E0]">
        <div className="skeleton h-[12px] w-[44px]" />
        <div className="skeleton h-[12px] w-[80px]" />
      </div>
    </div>
  )
}

export function FeedSkeleton({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </>
  )
}

export function SidebarRowSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-[#EAE7E0] last:border-b-0">
      <div className="skeleton h-[10px] w-[60%] mb-2" />
      <div className="skeleton h-[8px] w-[40%]" />
    </div>
  )
}

export function SidebarSkeleton({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SidebarRowSkeleton key={i} />
      ))}
    </>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-offwhite">
      <div className="bg-navy px-6 py-8">
        <div className="max-w-[700px] mx-auto flex items-center gap-5">
          <div className="skeleton w-16 h-16 rounded-[3px] !bg-white/10" />
          <div className="space-y-2">
            <div className="skeleton h-[18px] w-[180px] !bg-white/10" />
            <div className="skeleton h-[10px] w-[140px] !bg-white/10" />
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />
      <div className="max-w-[700px] mx-auto px-6 py-6">
        <div className="bg-card border border-lightgray p-5 mb-5 grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-[8px] w-[40%]" />
              <div className="skeleton h-[12px] w-[70%]" />
            </div>
          ))}
        </div>
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </div>
  )
}

export function PostDetailSkeleton() {
  return (
    <div className="min-h-screen bg-offwhite">
      <div className="max-w-[700px] mx-auto px-6 py-6">
        <div className="skeleton h-[10px] w-[100px] mb-3" />
        <div className="bg-card border border-lightgray border-l-[3px] border-l-gold px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-[12px] w-[140px]" />
              <div className="skeleton h-[8px] w-[80px]" />
            </div>
            <div className="skeleton h-[16px] w-[60px]" />
          </div>
          <div className="skeleton h-[22px] w-[80%] mb-3" />
          <div className="space-y-2 mb-4">
            <div className="skeleton h-[12px] w-full" />
            <div className="skeleton h-[12px] w-[95%]" />
            <div className="skeleton h-[12px] w-[70%]" />
          </div>
        </div>
      </div>
    </div>
  )
}
