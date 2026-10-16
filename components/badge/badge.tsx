import React from 'react'
import { BadgeProps } from './badge.types'
import { badgeStyles } from './badge.styles'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const Badge = ({ status, className, pulse = false }: BadgeProps) => {
  return (
    <span className={cn(
      badgeStyles.base, 
      badgeStyles.variants[status], 
      pulse && "animate-pulse", 
      className
    )}>
      {status}
    </span>
  )
}
