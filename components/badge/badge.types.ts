export type BadgeStatus = 'CONTATADO' | 'QUALIFICADO' | 'REUNIÃO 3ª' | 'NOVA' | 'FOLLOW-UP'

export interface BadgeProps {
  status: BadgeStatus
  className?: string
  pulse?: boolean
}
