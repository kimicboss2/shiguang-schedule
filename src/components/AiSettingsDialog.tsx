import { useEffect, useState } from 'react'
import { Bot, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clearAiConfig, DEFAULT_AI, loadAiConfig, saveAiConfig, type AiConfig } from '@/lib/ai'

interface Props {
  open: boolean
  onClose: () => void
}

export function AiSettingsDialog({ open, onClose }: Props) {
  const [cfg, setCfg] = useState<AiConfig>({ ...DEFAULT_AI })
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCfg(loadAiConfig())
      setShowKey(false)
      setError('')
    }
  }, [open])

  const save = () => {
    if (!cfg.baseUrl.trim()) {
      setError('请填写服务地址')
      return
    }
    if (!cfg.model.trim()) {
      setError('请填写模型名称')
      return
    }
    saveAiConfig({
      baseUrl: cfg.baseUrl.trim(),
      apiKey: cfg.apiKey.trim(),
      model: cfg.model.trim(),
    })
    toast.success('AI 助手配置已保存')
    onClose()
  }

  const clear = () => {
    clearAiConfig()
    setCfg({ ...DEFAULT_AI })
    toast.success('已清除本机的 AI 配置')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="anim-pop sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI 助手设置
          </DialogTitle>
          <DialogDescription>
            配置任意 OpenAI 兼容接口（Kimi、DeepSeek 等），即可用 AI 拆解任务、为目标生成行动计划。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ai-base">服务地址</Label>
            <Input
              id="ai-base"
              placeholder="https://api.moonshot.cn/v1"
              value={cfg.baseUrl}
              onChange={(e) => setCfg((c) => ({ ...c, baseUrl: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-key">API Key</Label>
            <div className="relative">
              <Input
                id="ai-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                autoComplete="off"
                className="pr-10"
                value={cfg.apiKey}
                onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Key 只保存在本机浏览器（localStorage），不会上传到其他服务器。可在 Kimi 开放平台（platform.moonshot.cn）创建。
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-model">模型</Label>
            <Input
              id="ai-model"
              placeholder="kimi-k3"
              value={cfg.model}
              onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              按你的服务商填写，例如 kimi-k3、kimi-k3.1-pro、deepseek-chat。
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <div>
            {cfg.apiKey && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clear}>
                清除配置
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
