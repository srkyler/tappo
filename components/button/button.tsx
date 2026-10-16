import React from 'react'
import { ButtonProps } from './button.types'
import { buttonStyles } from './button.styles'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  className, 
  children, 
  ...props 
}: ButtonProps) => {
  return (
    <button 
      className={cn(
        buttonStyles.base, 
        buttonStyles.variants[variant], 
        buttonStyles.sizes[size], 
        className
      )} 
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {variant === 'primary' && (
        <span className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-500 ease-in-out" />
      )}
    </button>
  )
}
