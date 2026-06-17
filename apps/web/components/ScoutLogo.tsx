'use client'

import Link from '@/components/Link'

interface ScoutLogoProps {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: { imgSize: 'w-7 h-7', textSize: 'text-lg' },
  md: { imgSize: 'w-9 h-9', textSize: 'text-xl' },
  lg: { imgSize: 'w-10 h-10', textSize: 'text-xl' },
}

export default function ScoutLogo({ href = '/', size = 'md', className = '' }: ScoutLogoProps) {
  const s = sizeMap[size]

  const logo = (
    <>
      <img src="/favicon.svg" alt="Scout" className={s.imgSize} />
      <span className={`logo-text ${s.textSize}`}>scout</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`flex items-center gap-2 ${className}`}>
        {logo}
      </Link>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {logo}
    </div>
  )
}
