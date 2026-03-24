'use client'

import { ReactNode } from 'react'

/** Props do container de página com largura máxima configurável. */
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
       
/**
 * Container centralizado para conteúdo de página com largura máxima padronizada.
 * Alterar `sizeClasses` neste arquivo afeta todos os layouts que usam este componente.
 */
export function PageContainer({ children, className = '', size = 'full', as: Tag = 'main' }: PageContainerProps) {
  return (
    <Tag className={`w-full mx-auto px-4 py-8 ${sizeClasses[size]} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
