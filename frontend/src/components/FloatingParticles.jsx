// Floating gold particles — tiny dots drift up a navy hero with
// staggered durations + offsets so the motion never syncs into a visible
// pattern. Pure decoration, pointer-events-none, hidden under reduced
// motion. Used on the auth hero AND the home hero so the brand has a
// consistent lived-in atmosphere across the public-facing pages.
//
// `count` controls how dense the field is. The component generates one
// motion span per particle at module import time (via PARTICLE_SPECS or
// the on-demand generator below), so React can key on a stable id and
// won't re-randomize the layout on every render.

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Deterministic pseudo-random so the particle field looks "designed"
// rather than truly random. Using a seeded LCG rather than Math.random
// so SSR and CSR agree, and re-renders don't relayout the field.
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function generateSpecs(count, seed = 1337) {
  const rand = seededRandom(seed)
  const specs = []
  for (let i = 0; i < count; i++) {
    // Distribute roughly evenly across the width with a small jitter
    // so they don't form a visible grid.
    const slot = (i / count) * 100
    const jitter = (rand() - 0.5) * 8
    specs.push({
      left: `${Math.max(2, Math.min(98, slot + jitter))}%`,
      // Sizes between 2 and 7 px — small enough to read as fireflies,
      // not splashes.
      size: 2 + Math.round(rand() * 5),
      // Durations between 14s and 28s — slow enough to feel ambient.
      duration: 14 + Math.round(rand() * 14),
      // Staggered delays across the longest duration so any given
      // moment has a steady population of in-flight particles instead
      // of the whole field drifting in lockstep.
      delay: rand() * 14,
      opacity: 0.3 + rand() * 0.45,
    })
  }
  return specs
}

export default function FloatingParticles({ count = 22, seed = 1337, className = '' }) {
  const prefersReducedMotion = useReducedMotion()
  // Memoized so the array is stable across re-renders — otherwise React
  // would key by index and remount every particle every parent render,
  // which kills the staggered effect.
  const specs = useMemo(() => generateSpecs(count, seed), [count, seed])
  if (prefersReducedMotion) return null
  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {specs.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-gold blur-[1px]"
          style={{
            left: p.left,
            bottom: -20,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: ['0vh', '-110vh'],
            opacity: [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'linear',
            delay: p.delay,
            times: [0, 0.15, 0.85, 1],
          }}
        />
      ))}
    </div>
  )
}
