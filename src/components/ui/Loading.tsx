'use client'

/* eslint-disable @next/next/no-img-element */

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-page">
      <div className="flex flex-col items-center gap-6 animate-fade-in px-8">
        {/* Logo theme-aware */}
        <div className="mb-2">
          <img
            src="/Logo-dark.png"
            alt="NoCheck"
            width={280}
            height={90}
            className="logo-for-light"
          />
          <img
            src="/Logo.png"
            alt="NoCheck"
            width={280}
            height={90}
            className="logo-for-dark"
          />
        </div>

        {/* Slogan */}
        <p className="text-muted text-sm text-center max-w-[260px] leading-relaxed">
          Checklists com praticidade e facilidade total
        </p>

        {/* Spinner */}
        <div className="mt-2">
          <div className="h-8 w-8 rounded-full border-[2.5px] border-primary/20 border-t-primary animate-spin" />
        </div>
      </div>
    </div>
  )
}

export function LoadingInline() {
  return <Loading size="sm" />
}
