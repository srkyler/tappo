#!/usr/bin/env bash
# Cria um projeto Supabase do zero pela Management API, sem precisar do site nem
# do Supabase CLI. Sempre `source`ado pelo install.sh — nunca execute direto.
# Precisa de um Personal Access Token (diferente das chaves do projeto):
# gera uma vez em https://supabase.com/dashboard/account/tokens
API="https://api.supabase.com/v1"

# Retorna 0 e preenche NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SUPABASE_SERVICE_ROLE_KEY /
# SUPABASE_DB_URL no .env se conseguir criar o projeto. Em qualquer falha, explica o
# motivo e deixa o install.sh seguir no caminho manual (nada quebra).
supabase_criar_projeto() {
  local token org_id org_nome nome regiao senha_db resp ref status tentativas
  token="$(env_get SUPABASE_ACCESS_TOKEN)"
  if [ -z "$token" ]; then
    perguntar SUPABASE_ACCESS_TOKEN "Token pessoal do Supabase (gere uma vez em supabase.com/dashboard/account/tokens)"
    token="$(env_get SUPABASE_ACCESS_TOKEN)"
  fi
  [ -n "$token" ] || { c_vermelho "Sem token, não dá pra criar o projeto sozinho."; return 1; }

  passo "Buscando suas organizações no Supabase"
  resp="$(curl -s -w '\n%{http_code}' "$API/organizations" -H "Authorization: Bearer $token")"
  status="$(echo "$resp" | tail -n1)"; resp="$(echo "$resp" | sed '$d')"
  if [ "$status" != "200" ]; then
    c_vermelho "Token inválido ou sem permissão (código $status). Gere um novo em supabase.com/dashboard/account/tokens."
    return 1
  fi
  local ids nomes n escolha
  ids=($(printf '%s' "$resp" | grep -oP '"id"\s*:\s*"[^"]*"' | sed -E 's/.*"([^"]*)"$/\1/' || true))
  nomes=($(printf '%s' "$resp" | grep -oP '"name"\s*:\s*"[^"]*"' | sed -E 's/.*"([^"]*)"$/\1/' || true))
  n="${#ids[@]}"
  if [ "$n" -eq 0 ]; then
    c_vermelho "Essa conta não tem nenhuma organização no Supabase. Crie uma em supabase.com/dashboard primeiro."
    return 1
  elif [ "$n" -eq 1 ]; then
    org_id="${ids[0]}"; org_nome="${nomes[0]}"
  else
    echo "Você tem mais de uma organização:"
    for i in "${!ids[@]}"; do echo "  $((i+1))) ${nomes[$i]}"; done
    read -r -p "Qual usar? (número): " escolha
    org_id="${ids[$((escolha-1))]}"; org_nome="${nomes[$((escolha-1))]}"
  fi
  [ -n "$org_id" ] || { c_vermelho "Organização inválida."; return 1; }
  c_verde "Usando a organização: $org_nome"

  read -r -p "Nome do projeto novo [tappo]: " nome; nome="${nome:-tappo}"
  read -r -p "Região [sa-east-1 = São Paulo, recomendado pro Brasil]: " regiao; regiao="${regiao:-sa-east-1}"
  senha_db="$(gerar_hex 20)"

  passo "Criando o projeto '$nome' (pode levar 1-3 minutos)"
  resp="$(curl -s -w '\n%{http_code}' -X POST "$API/projects" \
    -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
    -d "{\"name\":\"$nome\",\"organization_id\":\"$org_id\",\"region\":\"$regiao\",\"db_pass\":\"$senha_db\",\"plan\":\"free\"}")"
  status="$(echo "$resp" | tail -n1)"; resp="$(echo "$resp" | sed '$d')"
  if [ "$status" != "201" ] && [ "$status" != "200" ]; then
    c_vermelho "Não consegui criar o projeto (código $status): $resp"
    c_amarelo "Causas comuns: limite de projetos grátis da organização, ou precisa de cartão cadastrado na organização."
    return 1
  fi
  ref="$(json_get "$resp" id || true)"
  [ -n "$ref" ] || { c_vermelho "Resposta inesperada da API ao criar o projeto: $resp"; return 1; }
  c_verde "Projeto criado: $ref — https://supabase.com/dashboard/project/$ref"

  passo "Esperando o banco ficar saudável"
  tentativas=0
  while [ "$tentativas" -lt 36 ]; do
    status="$(json_get "$(curl -s "$API/projects/$ref" -H "Authorization: Bearer $token" || true)" status || true)"
    [ "$status" = "ACTIVE_HEALTHY" ] && break
    tentativas=$((tentativas + 1)); sleep 10
  done
  if [ "$status" != "ACTIVE_HEALTHY" ]; then
    c_amarelo "Ainda não ficou saudável depois de 6 min (status: $status). O projeto existe — confira em alguns minutos e preencha o .env manualmente se precisar."
    return 1
  fi
  c_verde "Banco pronto."

  passo "Buscando as chaves da API"
  resp="$(curl -s "$API/projects/$ref/api-keys" -H "Authorization: Bearer $token")"
  local anon service
  anon="$(printf '%s' "$resp" | grep -oP '"name"\s*:\s*"anon"[^}]*"api_key"\s*:\s*"[^"]*"' | grep -oP '(?<="api_key":")[^"]*' || true)"
  service="$(printf '%s' "$resp" | grep -oP '"name"\s*:\s*"service_role"[^}]*"api_key"\s*:\s*"[^"]*"' | grep -oP '(?<="api_key":")[^"]*' || true)"
  [ -n "$anon" ] && [ -n "$service" ] || { c_vermelho "Não consegui ler as chaves da API. Pegue manualmente em Project Settings > API: https://supabase.com/dashboard/project/$ref/settings/api"; }

  env_set NEXT_PUBLIC_SUPABASE_URL "https://$ref.supabase.co"
  env_set NEXT_PUBLIC_SUPABASE_ANON_KEY "$anon"
  env_set SUPABASE_SERVICE_ROLE_KEY "$service"

  passo "Descobrindo a connection string (session pooler)"
  if command -v psql >/dev/null; then
    local host candidata url_teste
    for host in "aws-0-$regiao.pooler.supabase.com" "aws-1-$regiao.pooler.supabase.com"; do
      candidata="postgresql://postgres.$ref:$senha_db@$host:5432/postgres"
      if PGCONNECT_TIMEOUT=6 psql "$candidata" -tAc 'select 1' >/dev/null 2>&1; then
        env_set SUPABASE_DB_URL "$candidata"
        c_verde "Connection string encontrada e testada."
        url_teste="ok"; break
      fi
    done
    [ -n "${url_teste:-}" ] || c_amarelo "Não achei o host do pooler automaticamente. Pegue em Project Settings > Database > Connection string > Session pooler, e cole em SUPABASE_DB_URL no .env."
  fi

  c_verde "Projeto Supabase configurado: https://supabase.com/dashboard/project/$ref"
  return 0
}
