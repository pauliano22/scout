'use client'

import NextLink from 'next/link'
import { useLoading } from './LoadingProvider'
import { ComponentProps } from 'react'

type LinkProps = ComponentProps<typeof NextLink> & {
  showLoading?: boolean
}

export default function Link({ showLoading = true, onClick, ...props }: LinkProps) {
  const { setIsLoading } = useLoading()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Don't show loading for external links or anchor links
    const href = props.href?.toString() || ''
    const isExternal = href.startsWith('http') || href.startsWith('//')
    const isAnchor = href.startsWith('#')
    
    if (showLoading && !isExternal && !isAnchor) {
      setIsLoading(true)
    }
    
    if (onClick) {
      onClick(e)
    }
  }

  return <NextLink {...props} onClick={handleClick} />
}