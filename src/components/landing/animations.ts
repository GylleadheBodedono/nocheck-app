// Constantes de animacao para a landing page (framer-motion)

export const easeOut = [0.16, 1, 0.3, 1] as const

export const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: easeOut } },
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: easeOut } },
}

export const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}
