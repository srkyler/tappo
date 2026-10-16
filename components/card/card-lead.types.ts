export interface Lead {
  id: string
  name: string
  role: string
  company: string
  status: 'CONTATADO' | 'QUALIFICADO' | 'REUNIÃO 3ª' | 'NOVA' | 'FOLLOW-UP'
  lastContact?: string
}

export interface CardLeadProps {
  lead: Lead
  onClick?: (lead: Lead) => void
  className?: string
}
