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
  lg: 'max-w-5xl',
  md: 'max-w-4xl',
  sm: 'max-w-3xl',
}

export function PageContainer({ children, className = '', size = 'full', as: Tag = 'main' }: PageContainerProps) {
  return (
    <Tag className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${sizeClasses[size]} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
