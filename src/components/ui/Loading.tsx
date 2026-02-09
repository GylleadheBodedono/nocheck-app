'use client'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
  text?: string
}

const sizeClasses = {
  sm: 'h-6 w-6 border-2',
  md: 'h-10 w-10 border-2',
  lg: 'h-12 w-12 border-[3px]',
}

export function Loading({ size = 'md', fullScreen = false, text }: LoadingProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`animate-spin rounded-full border-primary/30 border-t-primary ${sizeClasses[size]}`}
      />
      {text && <p className="text-muted text-sm">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        {spinner}
      </div>
    )
  }

  return spinner
}

export function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
        </div>
        <p className="text-muted text-sm animate-pulse">Carregando...</p>
      </div>
    </div>
  )
}

export function LoadingInline() {
  return <Loading size="sm" />
}
