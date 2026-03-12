'use client'

import { ReactNode } from 'react'

type PageContainerProps = {
  children: ReactNode
  className?: string
  size?: 'full' | 'lg' | 'md' | 'sm'
  as?: 'main' | 'div' | 'section'
}

// Tamanhos centralizados — mudar aqui afeta TUDO
const sizeClasses = {
  full: '',
  lg: 'max-w-[1600px]',
  md: 'max-w-5xl',
  sm: 'max-w-4xl',
}

export function PageContainer({ children, className = '', size = 'full', as: Tag = 'main' }: PageContainerProps) {
  return (
    <Tag className={`w-full mx-auto px-4 py-8 ${sizeClasses[size]} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
