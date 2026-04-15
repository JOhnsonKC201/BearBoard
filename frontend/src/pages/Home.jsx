import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-msu-blue via-[#00426e] to-[#001a33] text-white">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-msu-gold/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-80 h-80 bg-msu-gold/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-8 border border-white/10">
              <span className="w-2 h-2 bg-msu-gold rounded-full animate-pulse" />
              Morgan State University
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
              Your Campus,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-msu-gold to-yellow-300">
                Connected.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-blue-100 leading-relaxed mb-10 max-w-2xl">
              BearBoard is the hub where Bears find study groups, discover events,
              trade textbooks, and stay plugged into everything happening at Morgan State.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-msu-gold text-msu-blue font-bold px-8 py-3.5 rounded-lg text-lg hover:bg-yellow-400 transition-all hover:shadow-lg hover:shadow-msu-gold/25 hover:-translate-y-0.5"
              >
                Join BearBoard
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/feed"
                className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white font-semibold px-8 py-3.5 rounded-lg text-lg border border-white/20 hover:bg-white/20 transition-all hover:-translate-y-0.5"
              >
                Browse Feed
              </Link>
            </div>
          </div>

          {/* Floating preview cards */}
          <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 w-80 space-y-4">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 transform rotate-2 hover:rotate-0 transition-transform">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-msu-gold/20 flex items-center justify-center text-sm">
                  <svg className="w-4 h-4 text-msu-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-blue-100">Academic</span>
              </div>
              <p className="text-sm font-semibold">Study group for COSC 458</p>
              <p className="text-xs text-blue-200 mt-1">Looking for partners for the midterm...</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 transform -rotate-1 hover:rotate-0 transition-transform">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center text-sm">
                  <svg className="w-4 h-4 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-blue-100">Events</span>
              </div>
              <p className="text-sm font-semibold">Career Fair this Friday</p>
              <p className="text-xs text-blue-200 mt-1">Student Center, 10am - 4pm</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 transform rotate-1 hover:rotate-0 transition-transform">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-400/20 flex items-center justify-center text-sm">
                  <svg className="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-blue-100">General</span>
              </div>
              <p className="text-sm font-semibold">Welcome to BearBoard!</p>
              <p className="text-xs text-blue-200 mt-1">Your new campus community hub</p>
            </div>
          </div>
        </div>

        {/* Bottom wave divider */}
        <div className="relative">
          <svg className="w-full h-16 md:h-24" viewBox="0 0 1440 96" fill="none" preserveAspectRatio="none">
            <path d="M0 96L60 85.3C120 75 240 53 360 48C480 43 600 53 720 58.7C840 64 960 64 1080 56C1200 48 1320 32 1380 24L1440 16V96H1380C1320 96 1200 96 1080 96C960 96 840 96 720 96C600 96 480 96 360 96C240 96 120 96 60 96H0Z" fill="#f5f5f5" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-[#f5f5f5] py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-msu-blue mb-4">
              Everything you need on campus
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              One place for academics, events, and campus life at Morgan State.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
              color="blue"
              title="Study Groups"
              description="Find classmates, form study groups, and share notes for any course."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              color="gold"
              title="Campus Events"
              description="Stay up to date on parties, workshops, org meetings, and more."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
              color="green"
              title="Marketplace"
              description="Buy, sell, or trade textbooks, furniture, and gear with fellow Bears."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              color="purple"
              title="Discussions"
              description="Ask questions, get advice, and connect with your campus community."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
              color="orange"
              title="Housing"
              description="Find roommates, subleases, and off-campus housing near Morgan."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              color="red"
              title="Lost & Found"
              description="Lost your ID? Found someone's AirPods? Help each other out."
            />
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatItem number="Morgan" label="State Bears" />
            <StatItem number="24/7" label="Campus Feed" />
            <StatItem number="100%" label="Student-Run" />
            <StatItem number="Free" label="Always" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-msu-blue py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to join the Bear community?
          </h2>
          <p className="text-blue-200 text-lg mb-10 max-w-2xl mx-auto">
            Sign up with your Morgan State email and start connecting with
            thousands of Bears on campus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-msu-gold text-msu-blue font-bold px-8 py-3.5 rounded-lg text-lg hover:bg-yellow-400 transition-all hover:shadow-lg hover:shadow-msu-gold/25 hover:-translate-y-0.5"
            >
              Create Your Account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-white font-semibold px-8 py-3.5 rounded-lg text-lg border border-white/30 hover:bg-white/10 transition-all hover:-translate-y-0.5"
            >
              Already a member? Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#001a33] text-blue-300 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm">
            <span className="font-bold text-white">BearBoard</span> — Morgan State University
          </div>
          <div className="flex gap-6 text-sm">
            <Link to="/feed" className="hover:text-white transition-colors">Feed</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-msu-blue', border: 'border-blue-100' },
  gold: { bg: 'bg-amber-50', icon: 'text-msu-gold', border: 'border-amber-100' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
  red: { bg: 'bg-red-50', icon: 'text-red-500', border: 'border-red-100' },
}

function FeatureCard({ icon, color, title, description }) {
  const c = colorMap[color]
  return (
    <div className={`bg-white rounded-xl p-6 border ${c.border} hover:shadow-lg transition-all hover:-translate-y-1 group`}>
      <div className={`w-12 h-12 ${c.bg} rounded-lg flex items-center justify-center ${c.icon} mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StatItem({ number, label }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-extrabold text-msu-blue">{number}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  )
}

export default Home
