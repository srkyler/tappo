/* Presets de provedores. Seguro para importar no cliente (sem segredos). */

export type TipoProvedor = "anthropic" | "openai";

export type Preset = {
  id: string;
  nome: string;
  tipo: TipoProvedor;
  baseUrl: string | null;
  modelos: string[];
  chaveUrl?: string;
  nota?: string;
};

export const PRESETS: Preset[] = [
  {
    id: "anthropic", nome: "Anthropic (Claude)", tipo: "anthropic", baseUrl: null,
    modelos: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    chaveUrl: "https://platform.claude.com/settings/keys",
    nota: "SDK oficial, com cache de prompt e fallback automático. Sem chave usa ANTHROPIC_API_KEY do servidor.",
  },
  {
    id: "nvidia", nome: "NVIDIA NIM", tipo: "openai", baseUrl: "https://integrate.api.nvidia.com/v1",
    modelos: ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "mistralai/mixtral-8x22b-instruct-v0.1", "deepseek-ai/deepseek-r1"],
    chaveUrl: "https://build.nvidia.com",
  },
  {
    id: "openai", nome: "OpenAI", tipo: "openai", baseUrl: "https://api.openai.com/v1",
    modelos: ["gpt-4o-mini", "gpt-4o"], chaveUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "groq", nome: "Groq", tipo: "openai", baseUrl: "https://api.groq.com/openai/v1",
    modelos: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], chaveUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter", nome: "OpenRouter", tipo: "openai", baseUrl: "https://openrouter.ai/api/v1",
    modelos: ["meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat"], chaveUrl: "https://openrouter.ai/keys",
    nota: "Um só cadastro dá acesso a centenas de modelos.",
  },
  {
    id: "deepseek", nome: "DeepSeek", tipo: "openai", baseUrl: "https://api.deepseek.com/v1",
    modelos: ["deepseek-chat"], chaveUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "gemini", nome: "Google Gemini", tipo: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelos: ["gemini-2.0-flash", "gemini-1.5-pro"], chaveUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "mistral", nome: "Mistral", tipo: "openai", baseUrl: "https://api.mistral.ai/v1",
    modelos: ["mistral-small-latest", "mistral-large-latest"], chaveUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "together", nome: "Together AI", tipo: "openai", baseUrl: "https://api.together.xyz/v1",
    modelos: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"], chaveUrl: "https://api.together.ai/settings/api-keys",
  },
  {
    id: "ollama", nome: "Ollama (local)", tipo: "openai", baseUrl: "http://localhost:11434/v1",
    modelos: ["llama3.1", "qwen2.5"], nota: "Roda na sua máquina. Chave pode ficar vazia.",
  },
  {
    id: "custom", nome: "Outro (compatível com OpenAI)", tipo: "openai", baseUrl: "",
    modelos: [], nota: "Qualquer API no formato /chat/completions: informe a URL base e o modelo.",
  },
];

export const presetPorId = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
