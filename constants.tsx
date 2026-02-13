
import { FileItem } from './types';

export const AI_MODELS = [
  // Google Gemini Models (Text-out only)
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'Google', icon: '/assets/models/gemini-color.svg', color: 'text-blue-500', bg: 'bg-blue-50', acidColor: '#3B82F6' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'Google', icon: '/assets/models/gemini-color.svg', color: 'text-purple-500', bg: 'bg-purple-50', acidColor: '#A855F7' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', icon: '/assets/models/gemini-color.svg', color: 'text-cyan-500', bg: 'bg-cyan-50', acidColor: '#06B6D4' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', icon: '/assets/models/gemini-color.svg', color: 'text-indigo-500', bg: 'bg-indigo-50', acidColor: '#6366F1' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google', icon: '/assets/models/gemini-color.svg', color: 'text-sky-500', bg: 'bg-sky-50', acidColor: '#0EA5E9' },
  { id: 'gemini-2-flash', name: 'Gemini 2 Flash', provider: 'Google', icon: '/assets/models/gemini-color.svg', color: 'text-teal-500', bg: 'bg-teal-50', acidColor: '#14B8A6' },
  
  // OpenAI Frontier Models
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', icon: '/assets/models/openai.svg', color: 'text-emerald-600', bg: 'bg-emerald-50', acidColor: '#059669' },
  { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'OpenAI', icon: '/assets/models/openai.svg', color: 'text-green-600', bg: 'bg-green-50', acidColor: '#16A34A' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', icon: '/assets/models/openai.svg', color: 'text-teal-600', bg: 'bg-teal-50', acidColor: '#0D9488' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', icon: '/assets/models/openai.svg', color: 'text-cyan-600', bg: 'bg-cyan-50', acidColor: '#0891B2' },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', icon: '/assets/models/openai.svg', color: 'text-sky-600', bg: 'bg-sky-50', acidColor: '#0284C7' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', icon: '/assets/models/openai.svg', color: 'text-blue-600', bg: 'bg-blue-50', acidColor: '#2563EB' },
  
  // Anthropic Claude Models
  { id: 'claude-4.5-opus', name: 'Claude 4.5 Opus', provider: 'Anthropic', icon: '/assets/models/anthropic.svg', color: 'text-orange-500', bg: 'bg-orange-50', acidColor: '#F97316' },
  { id: 'claude-4.1-sonnet', name: 'Claude 4.1 Sonnet', provider: 'Anthropic', icon: '/assets/models/anthropic.svg', color: 'text-amber-500', bg: 'bg-amber-50', acidColor: '#F59E0B' },
  { id: 'claude-4.1-haiku', name: 'Claude 4.1 Haiku', provider: 'Anthropic', icon: '/assets/models/anthropic.svg', color: 'text-yellow-500', bg: 'bg-yellow-50', acidColor: '#EAB308' },
  { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', icon: '/assets/models/anthropic.svg', color: 'text-lime-500', bg: 'bg-lime-50', acidColor: '#84CC16' },
  
  // Meta Llama Models
  { id: 'llama-3.1-405b', name: 'Llama 3.1 Super', provider: 'Meta', icon: '/assets/models/meta-color.svg', color: 'text-indigo-600', bg: 'bg-indigo-50', acidColor: '#4F46E5' },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta', icon: '/assets/models/meta-color.svg', color: 'text-violet-600', bg: 'bg-violet-50', acidColor: '#7C3AED' },
  { id: 'llama-3-8b', name: 'Llama 3 8B', provider: 'Meta', icon: '/assets/models/meta-color.svg', color: 'text-purple-600', bg: 'bg-purple-50', acidColor: '#9333EA' },
  
  // Groq Models (xAI)
  { id: 'grok-4-1-fast-reasoning', name: 'grok-4-1-fast-reasoning', provider: 'Grok', icon: '/assets/models/grok.svg', color: 'text-rose-500', bg: 'bg-rose-50', acidColor: '#E11D48' },
  { id: 'grok-4-1-fast-non-reasoning', name: 'grok-4-1-fast-non-reasoning', provider: 'Grok', icon: '/assets/models/grok.svg', color: 'text-pink-500', bg: 'bg-pink-50', acidColor: '#EC4899' },
  { id: 'grok-4-fast-reasoning', name: 'grok-4-fast-reasoning', provider: 'Grok', icon: '/assets/models/grok.svg', color: 'text-fuchsia-500', bg: 'bg-fuchsia-50', acidColor: '#D946EF' },
  { id: 'grok-4-fast-non-reasoning', name: 'grok-4-fast-non-reasoning', provider: 'Grok', icon: '/assets/models/grok.svg', color: 'text-purple-500', bg: 'bg-purple-50', acidColor: '#A855F7' },
  
  // Ollama Models
  { id: 'ollama-llama3', name: 'Ollama Llama 3', provider: 'Ollama', icon: '/assets/models/ollama.svg', color: 'text-slate-600', bg: 'bg-slate-50', acidColor: '#475569' },
  { id: 'ollama-mistral', name: 'Ollama Mistral', provider: 'Ollama', icon: '/assets/models/ollama.svg', color: 'text-gray-600', bg: 'bg-gray-50', acidColor: '#4B5563' },
  { id: 'gpt-oss', name: 'GPT-OSS', provider: 'Ollama', icon: '/assets/models/openai.svg', color: 'text-slate-500', bg: 'bg-slate-50', acidColor: '#64748B' },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'Ollama', icon: '/assets/models/ollama.svg', color: 'text-zinc-600', bg: 'bg-zinc-50', acidColor: '#52525B' },
  
  // Qwen Models
  { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B', provider: 'Qwen', icon: '/assets/models/qwen-color.svg', color: 'text-blue-600', bg: 'bg-blue-50', acidColor: '#2563EB' },
  { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', provider: 'Qwen', icon: '/assets/models/qwen-color.svg', color: 'text-sky-600', bg: 'bg-sky-50', acidColor: '#0284C7' },
  
  // DeepSeek Models
  { id: 'deepseek-chat', name: 'DeepSeek-V3.2 Chat', provider: 'DeepSeek', icon: '/assets/models/deepseek-color.svg', color: 'text-indigo-500', bg: 'bg-indigo-50', acidColor: '#6366F1' },
  { id: 'deepseek-reasoner', name: 'DeepSeek-V3.2 Reasoner', provider: 'DeepSeek', icon: '/assets/models/deepseek-color.svg', color: 'text-blue-500', bg: 'bg-blue-50', acidColor: '#3B82F6' },
];

// Default folders created on app initialization
export const DEFAULT_FOLDERS: FileItem[] = [
  // --- Files (General) - 4 folders for PDF, code, documents, etc. ---
  { id: 'default-files-1', name: 'PDF Documents', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now(), parentId: null, isFolder: true, category: 'general' },
  { id: 'default-files-2', name: 'Code Files', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 1000, parentId: null, isFolder: true, category: 'general' },
  { id: 'default-files-3', name: 'Documents', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 2000, parentId: null, isFolder: true, category: 'general' },
  { id: 'default-files-4', name: 'Archives', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 3000, parentId: null, isFolder: true, category: 'general' },

  // --- Photos (Media) - 4 folders for JPEG, PNG, etc. ---
  { id: 'default-photos-1', name: 'JPEG Images', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 4000, parentId: null, isFolder: true, category: 'media' },
  { id: 'default-photos-2', name: 'PNG Graphics', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 5000, parentId: null, isFolder: true, category: 'media' },
  { id: 'default-photos-3', name: 'RAW Photos', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 6000, parentId: null, isFolder: true, category: 'media' },
  { id: 'default-photos-4', name: 'Screenshots', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 7000, parentId: null, isFolder: true, category: 'media' },

  // --- Videos - 4 folders for MP4, MP3, etc. ---
  { id: 'default-videos-1', name: 'MP4 Videos', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 8000, parentId: null, isFolder: true, category: 'video_vault' },
  { id: 'default-videos-2', name: 'MP3 Audio', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 9000, parentId: null, isFolder: true, category: 'video_vault' },
  { id: 'default-videos-3', name: 'Recordings', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 10000, parentId: null, isFolder: true, category: 'video_vault' },
  { id: 'default-videos-4', name: 'Streaming', type: 'folder', modified: 'Just now', modifiedTimestamp: Date.now() - 11000, parentId: null, isFolder: true, category: 'video_vault' },
];
