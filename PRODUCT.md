# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + Tailwind CSS + Supabase (auth, banco, RLS). Deploy alvo: Vercel. (Confirmado com o usuário.)

## Users

Times comerciais de empresas B2B brasileiras — SDRs, vendedores e gestores — que prospectam em volume e precisam escalar a operação de vendas. Hoje operam em planilhas e ferramentas separadas; o trabalho é encontrar os leads certos, abordar em cadência e acompanhar o resultado. (Inferido do briefing.)

## Product Purpose

Plataforma SaaS que centraliza prospecção e escala comercial: base de leads, campanhas com cadências, pipeline e analytics num só lugar. Sucesso = mais reuniões qualificadas por vendedor com menos trabalho manual. (Inferido do briefing + escopo confirmado: landing + app real com Supabase.)

## Positioning

Ciclo de prospecção inteiro num só produto — a empresa não precisa integrar cinco ferramentas. A oferta equivalente de mercado (lowstack.app) atende low ticket; o Tappo atende prospecção B2B. (Posicionamento assume decisão futura; pricing e diferenciais finais em aberto.)

## Operating Context

- Mercado brasileiro, produto em PT-BR.
- Rotina: garimpar leads, montar cadências, rodar campanhas, mover deals no pipeline, ler métricas semanais.
- Supabase real: auth por e-mail/senha, RLS por usuário, schema versionado em `supabase/`.

## Capabilities and Constraints

- v1 (confirmado): landing de vendas completa + app autenticado com módulos de leads, campanhas/cadências, pipeline e analytics.
- Dados de demonstração são sintéticos, sempre rotulados como tal.
- Em aberto: pricing final, domínio, integrações externas (e-mail, LinkedIn, WhatsApp), multi-tenant por organização.

## Brand Commitments

- Nome: Tappo (fixado pelo usuário). Identidade visual definida neste projeto, mundo novo.
- Idioma do produto: PT-BR.

## Evidence on Hand

Nenhum cliente, métrica, depoimento ou logo de parceiro real. Nada disso pode ser fabricado como verdade em telas de produção; se usado na landing, é exemplo demonstrativo rotulado.

## Product Principles

1. O pipeline é a fonte da verdade: cada número na tela deriva de dados reais do usuário.
2. Operação em um clique: iniciar cadência, mover estágio, registrar atividade sem formulários longos.
3. Dados sintéticos jamais se passam por reais.
