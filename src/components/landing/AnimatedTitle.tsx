'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { easeOut } from './animations'

export function AnimatedTitle({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <div ref={ref} className={`text-center ${className || ''}`}>
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: easeOut }}
        className="inline-block px-4 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase border border-[#0D9488]/20 text-[#0D9488]/70 bg-[#0D9488]/[0.04] mb-6"
      >
        {label}
      </motion.span>
      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {children}
      </h2>
    </div>
  )
}

export function TitleWord({ word, delay = 0, gradient = false }: { word: string; delay?: number; gradient?: boolean }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: easeOut }}
      className={gradient
        ? 'bg-gradient-to-r from-[#0D9488] via-[#2DD4BF] to-[#0D9488] bg-clip-text text-transparent'
        : 'text-white'
      }
    >
      {word}
    </motion.span>
  )
}
