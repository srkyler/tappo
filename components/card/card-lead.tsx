import React from 'react'
import { CardLeadProps } from './card-lead.types'
import { cardLeadStyles } from './card-lead.styles'
import { Badge } from '../badge/badge'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CardLead = ({ lead, onClick, className }: CardLeadProps) => {
  return (
    <article 
      className={cn(cardLeadStyles.base, className)} 
      onClick={() => onClick?.(lead)}
      tabIndex={0}
      role="button"
    >
      <div className={cn(cardLeadStyles.header)}>
        <div className={cn(cardLeadStyles.avatar)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="16" r="5"></circle>
            <path d="M22 21l-3-8a4 4 0 0 0-5.333-3H5a4 4 0 0 0-4 4l3 8a4 4 0 0 0 5.333 3z"></path>
          </svg>
        </div>
        <div className={cn(cardLeadStyles.info)}>
          <h3 className={cn(cardLeadStyles.name)}>{lead.name}</h3>
          <p className={cn(cardLeadStyles.role)}>{lead.role} · {lead.company}</p>
        </div>
      </div>
      
      <div className={cn(cardLeadStyles.footer)}>
        <Badge status={lead.status} />
        <div className={cn(cardLeadStyles.actions)}>
          <button className={cn(cardLeadStyles.actionBtn)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <button className={cn(cardLeadStyles.actionBtn)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>
    </article>
  )
}
