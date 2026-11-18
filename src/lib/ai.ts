/** AI 助手配置与调用：OpenAI 兼容接口（Kimi / DeepSeek 等均可），Key 只存本机浏览器 */

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

const AI_KEY = 'shiguang.ai.v1'

export const DEFAULT_AI: AiConfig = {
  baseUrl: 'https://api.moonshot.cn/v1',
  apiKey: '',
  model: 'kimi-k3',
}

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>
      return {
        baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl ? parsed.baseUrl : DEFAULT_AI.baseUrl,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
        model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_AI.model,
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_AI }
}

export function saveAiConfig(cfg: AiConfig): void {
  localStorage.setItem(AI_KEY, JSON.stringify(cfg))
}

export function clearAiConfig(): void {
  localStorage.removeItem(AI_KEY)
}

export function isAiReady(cfg: AiConfig): boolean {
  return cfg.apiKey.trim().length > 0 && cfg.baseUrl.trim().length > 0 && cfg.model.trim().length > 0
}

/** 调用 OpenAI 兼容的 chat/completions 接口，返回文本内容 */
export async function chatComplete(
  cfg: AiConfig,
  system: string,
  user: string,
  timeoutMs = 45000,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.6,
      }),
      signal: controller.signal,
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      let detail = ''
      try {
        const j = JSON.parse(text)
        detail = j?.error?.message ?? ''
      } catch {
        detail = text.slice(0, 120)
      }
      throw new Error(`AI 服务返回 ${resp.status}${detail ? `：${detail}` : ''}`)
    }
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('AI 没有返回内容，请换个模型重试')
    }
    return content
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('请求超时，请检查网络或服务地址')
    }
    if (e instanceof TypeError) {
      throw new Error('无法连接到 AI 服务：可能是跨域限制、地址错误或网络问题')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** 从 AI 回复中提取 JSON（容忍 Markdown 代码围栏和前后废话） */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.search(/[[{]/)
  if (start < 0) throw new Error('AI 返回格式无法解析，请重试')
  const isArray = cleaned[start] === '['
  const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
  if (end < start) throw new Error('AI 返回格式无法解析，请重试')
  return JSON.parse(cleaned.slice(start, end + 1)) as T
}
