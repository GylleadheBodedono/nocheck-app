'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useInView, useMotionValue, useTransform, animate, useScroll, useSpring } from 'framer-motion'
import Lenis from 'lenis'

// ─── WhatsApp config ───
const WHATSAPP_NUMBER = '5511999999999'
const WHATSAPP_MESSAGE = encodeURIComponent('Ola! Tenho interesse no NoCheck. Gostaria de saber mais.')
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`

// ─── Animation Variants ───
const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: easeOut } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}


// ─── Animated Section Title ───
function AnimatedTitle({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <div ref={ref} className={`text-center ${className}`}>
      {/* Label with line drawing in */}
      <motion.div
        className="inline-flex items-center gap-3 mb-4"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="h-px bg-gradient-to-r from-transparent to-[#D4A853]/60"
          initial={{ width: 0 }}
          animate={isInView ? { width: 40 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: easeOut }}
        />
        <motion.span
          className="text-sm font-medium text-[#D4A853] tracking-widest uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {label}
        </motion.span>
        <motion.div
          className="h-px bg-gradient-to-l from-transparent to-[#D4A853]/60"
          initial={{ width: 0 }}
          animate={isInView ? { width: 40 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: easeOut }}
        />
      </motion.div>

      {/* Title with word-by-word reveal */}
      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight overflow-hidden">
        {children}
      </div>

    </div>
  )
}

function TitleWord({ word, delay, gradient = false }: { word: string; delay: number; gradient?: boolean }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.span
      ref={ref}
      className="inline-block mr-[0.3em]"
      style={{
        perspective: '600px',
        ...(gradient
          ? { background: 'linear-gradient(135deg, #D4A853, #C47A4A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
          : undefined),
      }}
      initial={{ opacity: 0, x: -30, rotateY: -35, filter: 'blur(4px)' }}
      animate={isInView ? { opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.7, delay, ease: easeOut }}
    >
      {word}
    </motion.span>
  )
}

// ─── Feature Bento Card ───
function FeatureBentoCard({ feature, index, large = false }: { feature: typeof features[0]; index: number; large?: boolean }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.12, ease: easeOut }}
      className={`group relative rounded-[1.5rem] border border-white/[0.06] overflow-hidden transition-all duration-500 hover:border-[#D4A853]/20 ${large ? 'lg:col-span-7 min-h-[320px]' : 'lg:col-span-5 min-h-[320px]'}`}
      style={{
        background: 'linear-gradient(160deg, rgba(24,24,27,0.9) 0%, rgba(19,19,21,0.95) 100%)',
      }}
    >
      {/* Hover glow — appears on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(212, 168, 83, 0.06) 0%, transparent 60%)' }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-8 sm:p-10">
        {/* Top: tags + icon */}
        <div className="flex items-start justify-between mb-8">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {feature.tags.map((tag, t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full text-[11px] font-medium tracking-wide border border-[#D4A853]/15 text-[#D4A853]/80 bg-[#D4A853]/[0.05]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#D4A853]/[0.08] border border-[#D4A853]/[0.12] flex items-center justify-center text-[#D4A853] transition-all duration-500 group-hover:bg-[#D4A853]/[0.12] group-hover:scale-110">
            {feature.icon}
          </div>
        </div>

        {/* Bottom: text */}
        <div className="mt-auto">
          <h3 className="text-2xl sm:text-[1.75rem] font-bold leading-tight mb-3 text-[#fafafa] transition-colors duration-300 group-hover:text-[#D4A853]">
            {feature.title}
          </h3>
          <p className="text-[15px] text-[#71717a] leading-relaxed max-w-md group-hover:text-[#a1a1aa] transition-colors duration-300">
            {feature.description}
          </p>
        </div>
      </div>

      {/* Bottom-right decorative line */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{ background: 'radial-gradient(circle at 100% 100%, rgba(212, 168, 83, 0.08) 0%, transparent 70%)' }}
      />
    </motion.div>
  )
}

// ─── Counter Component ───
function AnimatedCounter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (v) => Math.round(v))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (isInView) {
      const controls = animate(motionValue, value, {
        duration: 2,
        ease: easeOut,
      })
      return controls.stop
    }
  }, [isInView, motionValue, value])

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => setDisplay(v))
    return unsubscribe
  }, [rounded])

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  )
}


// ─── Features data ───
const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: 'Checklists Personalizados',
    description: 'Crie templates sob medida para cada processo da sua operacao, com campos customizaveis e regras de validacao.',
    tags: ['Templates', 'Campos', 'Validacao'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Planos de Acao Automaticos',
    description: 'Nao-conformidades detectadas geram planos de acao instantaneamente com responsavel e prazo definidos.',
    tags: ['Automatico', 'Prazos', 'Responsaveis'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
    title: 'Funciona Offline',
    description: 'Continue trabalhando sem internet. Dados sincronizam automaticamente quando a conexao voltar.',
    tags: ['PWA', 'Sync', 'Sem Internet'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Relatorios em Tempo Real',
    description: 'Dashboards e metricas atualizados instantaneamente para decisoes rapidas e baseadas em dados.',
    tags: ['Dashboard', 'Metricas', 'Exportar'],
  },
]

// ─── Steps data ───
const steps = [
  {
    number: '01',
    title: 'Configure',
    description: 'Crie seus templates de checklist, defina campos, regras de validacao e condicoes de nao-conformidade.',
  },
  {
    number: '02',
    title: 'Execute',
    description: 'Sua equipe preenche os checklists pelo celular ou tablet — funciona ate sem internet.',
  },
  {
    number: '03',
    title: 'Acompanhe',
    description: 'Veja resultados em tempo real, receba alertas de nao-conformidade e gerencie planos de acao.',
  },
]

// ─── Stats data ───
const stats = [
  { value: 99.9, suffix: '%', label: 'Uptime garantido' },
  { value: 100, suffix: '%', label: 'Funcional offline' },
  { value: 500, prefix: '+', label: 'Checklists por mes' },
  { value: 0, suffix: 's', label: 'Tempo de resposta', displayOverride: 'Tempo real' },
]

// ─── Glowing Smoke Background ───
const smokeBlobs = [
  { color: '#D4A853', size: 'w-[350px] h-[300px]', pos: 'top-[5%] left-[-8%]', blur: 180, drift: 'animate-smoke-drift-1', py: [-180, 60] },
  { color: '#C47A4A', size: 'w-[300px] h-[250px]', pos: 'top-[18%] right-[-10%]', blur: 200, drift: 'animate-smoke-drift-2', py: [120, -80] },
  { color: '#D4A853', size: 'w-[320px] h-[280px]', pos: 'top-[42%] left-[5%]', blur: 190, drift: 'animate-smoke-drift-3', py: [-250, 50] },
  { color: '#C47A4A', size: 'w-[280px] h-[240px]', pos: 'top-[58%] right-[0%]', blur: 200, drift: 'animate-smoke-drift-1', py: [160, -40] },
  { color: '#D4A853', size: 'w-[260px] h-[220px]', pos: 'top-[76%] left-[-5%]', blur: 170, drift: 'animate-smoke-drift-2', py: [-100, 70] },
  { color: '#C47A4A', size: 'w-[300px] h-[260px]', pos: 'top-[88%] right-[-8%]', blur: 190, drift: 'animate-smoke-drift-3', py: [200, -60] },
]

function SmokeBackground() {
  const { scrollYProgress } = useScroll()

  // Parallax Y for each blob
  const parallax = [
    { y: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[0].py[0]]), x: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[0].py[1]]) },
    { y: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[1].py[0]]), x: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[1].py[1]]) },
    { y: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[2].py[0]]), x: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[2].py[1]]) },
    { y: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[3].py[0]]), x: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[3].py[1]]) },
    { y: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[4].py[0]]), x: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[4].py[1]]) },
    { y: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[5].py[0]]), x: useTransform(scrollYProgress, [0, 1], [0, smokeBlobs[5].py[1]]) },
  ]

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      {smokeBlobs.map((blob, i) => (
        // Outer: framer-motion parallax (y + x from scroll)
        <motion.div
          key={i}
          className={`absolute ${blob.pos}`}
          style={{ y: parallax[i].y, x: parallax[i].x }}
        >
          {/* Inner: CSS drift animation + opacity pulse (no conflict) */}
          <div
            className={`rounded-full ${blob.size} ${blob.drift} animate-smoke-pulse`}
            style={{ background: blob.color, filter: `blur(${blob.blur}px)` }}
          />
        </motion.div>
      ))}
    </div>
  )
}

// ─── Process Graph (interactive node visualization) ───
function ProcessGraph() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-28 px-6 relative">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(ellipse, #D4A853 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-4xl mx-auto relative">
        <AnimatedTitle label="Processo" className="mb-20">
          <TitleWord word="Como" delay={0.1} />
          <TitleWord word="funciona" delay={0.22} gradient />
        </AnimatedTitle>

        <div ref={ref} className="relative">
          {/* ── Desktop: horizontal connection line ── */}
          <div className="hidden lg:block absolute top-10 left-[16.67%] right-[16.67%] z-0">
            <motion.div
              className="h-px w-full origin-left"
              style={{ background: 'linear-gradient(90deg, rgba(212,168,83,0.3), rgba(196,122,74,0.15), rgba(212,168,83,0.3))' }}
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.4, ease: easeOut }}
            />
            {/* Traveling dot */}
            <motion.div
              className="absolute top-0 -translate-y-1/2 w-2 h-2 rounded-full bg-[#D4A853]"
              style={{ boxShadow: '0 0 10px rgba(212,168,83,0.8), 0 0 20px rgba(212,168,83,0.3)' }}
              initial={{ left: '0%', opacity: 0 }}
              animate={isInView ? {
                left: ['0%', '100%', '0%'],
                opacity: [0, 0.9, 0.9, 0],
              } : {}}
              transition={{ duration: 4, delay: 1.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
            />
          </div>

          {/* ── Mobile: vertical connection lines ── */}
          <div className="lg:hidden absolute top-0 left-1/2 -translate-x-1/2 w-px h-full z-0">
            <motion.div
              className="w-px h-full origin-top"
              style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(212,168,83,0.2) 15%, rgba(212,168,83,0.2) 85%, transparent 100%)' }}
              initial={{ scaleY: 0 }}
              animate={isInView ? { scaleY: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.4, ease: easeOut }}
            />
          </div>

          {/* ── Nodes ── */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.25, ease: easeOut }}
              >
                {/* Node circle with pulse ring */}
                <div className="relative mb-6">
                  {/* Outer pulse ring */}
                  <motion.div
                    className="absolute -inset-4 rounded-full border border-[#D4A853]/15"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.8, ease: 'easeInOut' }}
                  />
                  {/* Inner glow pulse */}
                  <motion.div
                    className="absolute -inset-2 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(212,168,83,0.1) 0%, transparent 70%)' }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5 + 0.3, ease: 'easeInOut' }}
                  />
                  <div className="w-20 h-20 rounded-full border-2 border-[#D4A853]/25 bg-[#09090b] flex items-center justify-center relative overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{ background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)' }}
                    />
                    <span className="text-2xl font-bold bg-gradient-to-br from-[#D4A853] to-[#C47A4A] bg-clip-text text-transparent relative">
                      {step.number}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-[#71717a] text-sm leading-relaxed max-w-[260px]">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Floating Particles (ambient motion) ───
const particles = [
  { size: 3, x: '7%', y: '14%', dx: [0, 45, -20, 35, 0], dy: [0, -35, 50, -20, 0], dur: 20, color: '#D4A853', op: 0.25 },
  { size: 2, x: '88%', y: '22%', dx: [0, -35, 25, -15, 0], dy: [0, 40, -25, 35, 0], dur: 24, color: '#C47A4A', op: 0.2 },
  { size: 4, x: '14%', y: '48%', dx: [0, 30, -40, 20, 0], dy: [0, -20, 35, -45, 0], dur: 18, color: '#D4A853', op: 0.18 },
  { size: 2, x: '80%', y: '56%', dx: [0, -25, 40, -30, 0], dy: [0, 30, -20, 40, 0], dur: 22, color: '#D4A853', op: 0.22 },
  { size: 3, x: '45%', y: '72%', dx: [0, 35, -30, 25, 0], dy: [0, -40, 20, -30, 0], dur: 26, color: '#C47A4A', op: 0.2 },
  { size: 2, x: '25%', y: '85%', dx: [0, -20, 35, -25, 0], dy: [0, 25, -35, 20, 0], dur: 19, color: '#D4A853', op: 0.18 },
  { size: 3, x: '65%', y: '35%', dx: [0, 40, -25, 30, 0], dy: [0, -30, 40, -20, 0], dur: 21, color: '#C47A4A', op: 0.15 },
  { size: 2, x: '52%', y: '8%', dx: [0, -30, 20, -35, 0], dy: [0, 35, -25, 30, 0], dur: 23, color: '#D4A853', op: 0.2 },
  { size: 3, x: '92%', y: '68%', dx: [0, -40, 30, -20, 0], dy: [0, -25, 35, -30, 0], dur: 17, color: '#C47A4A', op: 0.22 },
  { size: 2, x: '35%', y: '92%', dx: [0, 25, -35, 40, 0], dy: [0, -35, 20, -25, 0], dur: 25, color: '#D4A853', op: 0.15 },
]

function FloatingParticles() {
  return (
    <div className="fixed inset-0 z-[1] pointer-events-none" aria-hidden="true">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, left: p.x, top: p.y, background: p.color }}
          animate={{
            x: p.dx,
            y: p.dy,
            opacity: [p.op, p.op * 1.6, p.op, p.op * 0.7, p.op],
          }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ─── Main Component ───
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const { scrollYProgress } = useScroll()
  const tabletRef = useRef(null)
  const { scrollYProgress: tabletScrollProgress } = useScroll({
    target: tabletRef,
    offset: ['start end', 'end start'],
  })
  const tabletSpring = { stiffness: 80, damping: 25, mass: 0.8 }
  const tabletRotateX = useSpring(useTransform(tabletScrollProgress, [0, 0.5], [45, 0]), tabletSpring)
  const tabletScale = useSpring(useTransform(tabletScrollProgress, [0, 0.5], [0.85, 1]), tabletSpring)
  const tabletOpacity = useTransform(tabletScrollProgress, [0, 0.25], [0, 1])
  const tabletY = useSpring(useTransform(tabletScrollProgress, [0, 0.5], [60, 0]), tabletSpring)

  // Debug: verificar se a landing page esta montando
  useEffect(() => {
    console.log('[LandingPage] MOUNTED at', window.location.href)
  }, [])

  // Detect email confirmation hash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash && (hash.includes('type=signup') || hash.includes('type=invite'))) {
        window.location.href = '/auth/confirmed'
      }
    }
  }, [])

  // Lenis smooth scroll — buttery momentum
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  // Scroll detection for nav
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] overflow-x-hidden" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
      {/* ═══════════════════ PROGRESS BAR ═══════════════════ */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left"
        style={{
          scaleX: scrollYProgress,
          background: 'linear-gradient(90deg, #D4A853, #C47A4A)',
        }}
      />

      {/* ═══════════════════ GLOWING SMOKE BACKGROUND ═══════════════════ */}
      <SmokeBackground />
      <FloatingParticles />

      {/* ═══════════════════ CORNER GLOW BLURS (glass effect) ═══════════════════ */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Top-left */}
        <div
          className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full"
          style={{ background: '#D4A853', opacity: 0.06, filter: 'blur(180px)' }}
        />
        {/* Top-right */}
        <div
          className="absolute -top-40 -right-40 w-[350px] h-[350px] rounded-full"
          style={{ background: '#C47A4A', opacity: 0.05, filter: 'blur(180px)' }}
        />
        {/* Bottom-left */}
        <div
          className="absolute -bottom-32 -left-32 w-[380px] h-[380px] rounded-full"
          style={{ background: '#C47A4A', opacity: 0.05, filter: 'blur(180px)' }}
        />
        {/* Bottom-right */}
        <div
          className="absolute -bottom-28 -right-28 w-[420px] h-[420px] rounded-full"
          style={{ background: '#D4A853', opacity: 0.07, filter: 'blur(200px)' }}
        />
      </div>

      {/* ═══════════════════ NAV (floating pill) ═══════════════════ */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: scrolled ? 0 : -80, opacity: scrolled ? 1 : 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/[0.08] px-2 py-1.5"
        style={{
          background: 'rgba(9, 9, 11, 0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2 px-3">
          <Image src="/Logo.png" alt="NoCheck" width={100} height={28} className="opacity-90" />
          <div className="w-px h-5 bg-white/[0.08]" />
          <Link
            href="/login"
            className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors duration-300 px-3 py-1.5 rounded-full hover:bg-white/[0.06] whitespace-nowrap"
          >
            Entrar
          </Link>
        </div>
      </motion.nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden pt-24 pb-12">
        {/* Background effects */}
        <div className="absolute inset-0">
          {/* Radial gradient */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full opacity-20"
            style={{
              background: 'radial-gradient(ellipse, rgba(212, 168, 83, 0.3) 0%, rgba(196, 122, 74, 0.1) 40%, transparent 70%)',
            }}
          />
          {/* Floating orbs */}
          <div className="absolute top-[20%] left-[15%] w-72 h-72 rounded-full bg-[#D4A853]/[0.06] blur-[100px] animate-[float-slow_8s_ease-in-out_infinite]" />
          <div className="absolute bottom-[20%] right-[10%] w-96 h-96 rounded-full bg-[#C47A4A]/[0.05] blur-[120px] animate-[float-delayed_10s_ease-in-out_infinite_2s]" />
          <div className="absolute top-[60%] left-[60%] w-48 h-48 rounded-full bg-[#D4A853]/[0.04] blur-[80px] animate-[float-slow-reverse_12s_ease-in-out_infinite_4s]" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: easeOut }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#D4A853]/20 bg-[#D4A853]/[0.08] mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853] animate-pulse" />
            <span className="text-sm text-[#D4A853] font-medium tracking-wide">Sistema de Gestao Operacional</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            {['Checklists', 'inteligentes', 'para sua', 'operacao'].map((word, i) => (
              <motion.span
                key={i}
                variants={fadeInUp}
                className="inline-block mr-[0.3em]"
                style={
                  word === 'inteligentes'
                    ? { background: 'linear-gradient(135deg, #D4A853, #C47A4A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                    : undefined
                }
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: easeOut }}
            className="text-lg sm:text-xl text-[#a1a1aa] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Automatize processos, detecte nao-conformidades instantaneamente e tome decisoes
            com dados em tempo real. Tudo em um so lugar.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: easeOut }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-[#09090b] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(212,168,83,0.3)]"
              style={{ background: 'linear-gradient(135deg, #D4A853, #C47A4A)' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Entrar em Contato
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 transition-transform group-hover:translate-x-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-medium text-[#a1a1aa] border border-white/[0.08] hover:border-white/[0.16] hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-300"
            >
              Ja sou cliente
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </motion.div>
        </div>

        {/* ═══════════════════ TABLET MOCKUP 3D ═══════════════════ */}
        <div ref={tabletRef} className="relative z-10 mt-10 sm:mt-14 px-4" style={{ perspective: '1200px' }}>
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.1, ease: easeOut }}
            style={{
              rotateX: tabletRotateX,
              scale: tabletScale,
              opacity: tabletOpacity,
              y: tabletY,
              transformOrigin: 'center bottom',
            }}
            className="relative mx-auto w-full max-w-[1100px]"
          >
            {/* Glow behind tablet */}
            <div
              className="absolute -inset-12 rounded-[2rem] opacity-50 blur-[80px] -z-10"
              style={{
                background: 'radial-gradient(ellipse at 50% 60%, rgba(212, 168, 83, 0.35) 0%, rgba(196, 122, 74, 0.15) 40%, transparent 70%)',
              }}
            />
            {/* Tablet frame */}
            <div className="relative rounded-2xl sm:rounded-3xl border-[4px] sm:border-[6px] border-[#27272a] bg-[#18181b] p-2 sm:p-4 shadow-[0_30px_100px_rgba(0,0,0,0.7)]">
              {/* Screen */}
              <div className="relative rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/screen1.png"
                  alt="Painel administrativo NoCheck"
                  width={1200}
                  height={750}
                  className="w-full h-auto"
                  priority
                />
                {/* Subtle screen glare */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, transparent 100%)',
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="relative z-10 mt-12 sm:mt-16"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-white/[0.15] flex items-start justify-center pt-2 mx-auto"
          >
            <div className="w-1 h-2 rounded-full bg-[#D4A853]/60" />
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section className="px-6 py-28">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <AnimatedTitle label="Recursos">
              <TitleWord word="Por" delay={0.1} />
              <TitleWord word="que" delay={0.18} />
              <TitleWord word="escolher" delay={0.26} />
              <TitleWord word="o" delay={0.34} />
              <TitleWord word="NoCheck" delay={0.42} gradient />
              <TitleWord word="?" delay={0.50} />
            </AnimatedTitle>
          </div>

          {/* Bento Grid: row1 = large+small, row2 = small+large */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <FeatureBentoCard feature={features[0]} index={0} large />
            <FeatureBentoCard feature={features[1]} index={1} />
            <FeatureBentoCard feature={features[2]} index={2} />
            <FeatureBentoCard feature={features[3]} index={3} large />
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS — Graph ═══════════════════ */}
      <ProcessGraph />

      {/* ═══════════════════ STATS ═══════════════════ */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#D4A853]/[0.02] to-transparent" />

        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
                className="text-center p-6"
              >
                <div className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-br from-[#D4A853] to-[#C47A4A] bg-clip-text text-transparent">
                  {stat.displayOverride ? (
                    stat.displayOverride
                  ) : (
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} prefix={stat.prefix || ''} />
                  )}
                </div>
                <div className="text-sm text-[#71717a] font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ TESTIMONIAL / TRUST ═══════════════════ */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeIn}
            className="relative p-10 sm:p-14 rounded-3xl border border-white/[0.06] bg-[#18181b]/40 text-center overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-[0.06]"
                style={{ background: 'radial-gradient(ellipse, #D4A853 0%, transparent 70%)' }}
              />
            </div>

            <div className="relative">
              {/* Quote icon */}
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#D4A853]/[0.1] border border-[#D4A853]/[0.15] mb-6">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#D4A853]">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z" />
                </svg>
              </div>

              <p className="text-xl sm:text-2xl leading-relaxed text-[#a1a1aa] mb-8 font-light">
                &ldquo;O NoCheck transformou a forma como gerenciamos a qualidade na nossa operacao.
                Antes era tudo no papel, agora temos controle total em tempo real.&rdquo;
              </p>

              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A853] to-[#C47A4A] flex items-center justify-center text-sm font-bold text-[#09090b]">
                  GN
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-[#fafafa]">Grupo Do No</div>
                  <div className="text-xs text-[#71717a]">Gestao de Qualidade</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ CTA FINAL ═══════════════════ */}
      <section className="py-28 px-6 relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full opacity-[0.08]"
            style={{ background: 'radial-gradient(ellipse, #D4A853 0%, transparent 60%)' }}
          />
        </div>

        <div className="max-w-3xl mx-auto text-center relative">
          <div className="mb-6">
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              <TitleWord word="Pronto" delay={0.1} />
              <TitleWord word="para" delay={0.18} />
              <TitleWord word="transformar" delay={0.26} />
              <TitleWord word="sua" delay={0.34} gradient />
              <TitleWord word="operacao" delay={0.42} gradient />
              <TitleWord word="?" delay={0.50} />
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.5, ease: easeOut }}
            className="text-lg text-[#a1a1aa] mb-10 max-w-xl mx-auto"
          >
            Fale com a gente e descubra como o NoCheck pode ajudar sua empresa a ter mais controle, eficiencia e conformidade.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.6, ease: easeOut }}
          >
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-semibold text-lg text-[#09090b] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(212,168,83,0.35)]"
              style={{ background: 'linear-gradient(135deg, #D4A853, #C47A4A)' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Entrar em Contato
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 transition-transform group-hover:translate-x-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/Logo.png" alt="NoCheck" width={90} height={24} className="opacity-60" />
            <span className="text-sm text-[#71717a]">
              &copy; {new Date().getFullYear()} Grupo Do No
            </span>
          </div>
          <Link
            href="/login"
            className="text-sm text-[#71717a] hover:text-[#a1a1aa] transition-colors duration-300"
          >
            Area do Cliente
          </Link>
        </div>
      </footer>
    </div>
  )
}
