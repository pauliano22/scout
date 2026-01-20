'use client'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

// Generate a consistent gradient based on name
function getGradientClass(name: string): string {
  const gradients = [
    'avatar-gradient-1',
    'avatar-gradient-2',
    'avatar-gradient-3',
    'avatar-gradient-4',
    'avatar-gradient-5',
    'avatar-gradient-6',
    'avatar-gradient-7',
  ]

  // Simple hash function to get consistent color per name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return gradients[Math.abs(hash) % gradients.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

export default function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name)
  const gradientClass = getGradientClass(name)
  const sizeClass = sizeClasses[size]

  return (
    <div
      className={`${sizeClass} ${gradientClass} rounded-full flex items-center justify-center font-semibold text-white shadow-md flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  )
}
