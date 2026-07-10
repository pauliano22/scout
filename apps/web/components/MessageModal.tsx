'use client'

import { useState, useEffect } from 'react'
import { UserNetwork } from '@scout/shared/types/database'
import { X, Copy, Check, Linkedin, RefreshCw, Mail, ExternalLink, ChevronDown } from 'lucide-react'

interface MessageModalProps {
  connection: UserNetwork
  userSport: string
  onClose: () => void
  onSend: (connectionId: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => Promise<void>
  /** Seed with a pre-written draft (e.g. the campaign cron's draft) — shown
   *  as-is instead of auto-generating. The student can still edit/regenerate. */
  initialMessage?: string
  initialPlatform?: 'linkedin' | 'email'
  initialType?: 'introduction' | 'follow_up' | 'thank_you'
}

type Tone        = 'friendly' | 'neutral' | 'formal'
type MessageType = 'introduction' | 'follow_up' | 'thank_you'
type Platform    = 'linkedin' | 'email'

const LINKEDIN_CHAR_LIMIT = 300

const TONES: { key: Tone; label: string }[] = [
  { key: 'friendly', label: 'Friendly' },
  { key: 'neutral',  label: 'Balanced' },
  { key: 'formal',   label: 'Formal' },
]

const TYPES: { key: MessageType; label: string }[] = [
  { key: 'introduction', label: 'Introduction' },
  { key: 'follow_up',    label: 'Follow Up' },
  { key: 'thank_you',    label: 'Thank You' },
]

export default function MessageModal({ connection, userSport, onClose, onSend, initialMessage, initialPlatform, initialType }: MessageModalProps) {
  const alumni = connection.alumni
  const hasLinkedIn = !!alumni?.linkedin_url

  const defaultPlatform: Platform = initialPlatform ?? (hasLinkedIn ? 'linkedin' : 'email')
  const defaultType: MessageType = initialType ?? 'introduction'
  const seedKey = `${defaultPlatform}_${defaultType}_neutral`

  const [platform, setPlatform]         = useState<Platform>(defaultPlatform)
  const [selectedTone, setSelectedTone] = useState<Tone>('neutral')
  const [selectedType, setSelectedType] = useState<MessageType>(defaultType)
  const [messages, setMessages]         = useState<Record<string, string>>(initialMessage ? { [seedKey]: initialMessage } : {})
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({})
  const [isSending, setIsSending]       = useState(false)
  const [isCopied, setIsCopied]         = useState(false)
  const [showEmailOptions, setShowEmailOptions] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  if (!alumni) return null

  const currentKey      = `${platform}_${selectedType}_${selectedTone}`
  const currentMessage  = messages[currentKey] || ''
  const isCurrentlyGenerating = !!isGenerating[currentKey]
  const charCount       = currentMessage.length
  const overLimit       = platform === 'linkedin' && charCount > LINKEDIN_CHAR_LIMIT

  const generateMessage = async (p: Platform, tone: Tone, type: MessageType) => {
    const key = `${p}_${type}_${tone}`
    setIsGenerating(prev => ({ ...prev, [key]: true }))
    setError(null)
    try {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumni, tone, messageType: type, platform: p }),
      })
      if (!res.ok) throw new Error('Failed to generate message')
      const data = await res.json()
      setMessages(prev => ({ ...prev, [key]: data.message }))
    } catch {
      setError('Failed to generate. Please try again.')
    } finally {
      setIsGenerating(prev => ({ ...prev, [key]: false }))
    }
  }

  // Generate on mount and when controls change
  useEffect(() => {
    if (!messages[currentKey] && !isGenerating[currentKey]) {
      generateMessage(platform, selectedTone, selectedType)
    }
  }, [platform, selectedTone, selectedType])

  useEffect(() => {
    // When seeded with a pre-written draft (campaign home), show it as-is rather
    // than auto-generating a fresh one on open.
    if (!initialMessage) generateMessage(platform, selectedTone, selectedType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clipboard + popups both fail inside Instagram/TikTok in-app browsers:
  // navigator.clipboard throws NotAllowedError and window.open returns null.
  // Fall back to the textarea trick and same-tab navigation so the actions
  // never silently no-op.
  const safeCopy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    }
  }

  const openExternal = (url: string) => {
    const w = window.open(url, '_blank')
    if (!w) window.location.href = url
  }

  const handleCopyAndOpenLinkedIn = async () => {
    if (!currentMessage) return
    await safeCopy(currentMessage)
    await onSend(connection.id, currentMessage, 'linkedin')
    if (alumni.linkedin_url) openExternal(alumni.linkedin_url)
    setIsCopied(true)
    setTimeout(() => { setIsCopied(false); onClose() }, 800)
  }

  const handleCopy = async () => {
    if (!currentMessage) return
    await safeCopy(currentMessage)
    await onSend(connection.id, currentMessage, 'copied')
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleEmail = async (provider: 'gmail' | 'outlook') => {
    if (!currentMessage) return
    await onSend(connection.id, currentMessage, 'email')
    const subject = encodeURIComponent(`Cornell ${userSport || 'Athletics'} — Networking Request`)
    const body    = encodeURIComponent(currentMessage)
    const to      = alumni.email || ''
    const url = provider === 'gmail'
      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`
      : `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`
    openExternal(url)
    setTimeout(() => onClose(), 500)
  }

  const handleMarkSent = async () => {
    if (!currentMessage) return
    setIsSending(true)
    try {
      await onSend(connection.id, currentMessage, 'marked')
      onClose()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[--bg-primary] border border-[--border-primary] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-auto animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[--border-primary]">
          <div>
            <h2 className="text-base font-semibold text-[--text-primary]">
              Message {alumni.full_name?.split(' ')[0]}
            </h2>
            <p className="text-xs text-[--text-quaternary] mt-0.5">
              AI-drafted · review before sending
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 -mr-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Platform toggle */}
          <div className="flex gap-1 p-1 bg-[--bg-secondary] rounded-xl">
            <button
              onClick={() => setPlatform('linkedin')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                platform === 'linkedin'
                  ? 'bg-[--bg-primary] text-[#0077b5] shadow-sm border border-[--border-primary]'
                  : 'text-[--text-quaternary] hover:text-[--text-secondary]'
              }`}
            >
              <Linkedin size={12} />
              LinkedIn
              {hasLinkedIn && platform !== 'linkedin' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[--school-primary]" />
              )}
            </button>
            <button
              onClick={() => setPlatform('email')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                platform === 'email'
                  ? 'bg-[--bg-primary] text-[--text-primary] shadow-sm border border-[--border-primary]'
                  : 'text-[--text-quaternary] hover:text-[--text-secondary]'
              }`}
            >
              <Mail size={12} />
              Email
            </button>
          </div>

          {/* LinkedIn note */}
          {platform === 'linkedin' && (
            <p className="text-xs text-[--text-quaternary] -mt-1">
              Optimized for LinkedIn connection requests · 300 character limit
            </p>
          )}

          {/* Type + Tone */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-xs text-[--text-quaternary] mb-1.5 font-medium">Type</p>
              <div className="flex flex-col gap-1">
                {TYPES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    className={`text-left text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                      selectedType === key
                        ? 'bg-[--school-primary] text-white'
                        : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-[--text-quaternary] mb-1.5 font-medium">Tone</p>
              <div className="flex flex-col gap-1">
                {TONES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTone(key)}
                    className={`text-left text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                      selectedTone === key
                        ? 'bg-[--bg-tertiary] text-[--text-primary] border border-[--border-secondary]'
                        : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message body */}
          <div className={`bg-[--bg-secondary] border rounded-xl p-4 min-h-[140px] transition-colors ${
            overLimit ? 'border-red-500/50' : 'border-[--border-primary]'
          }`}>
            {isCurrentlyGenerating ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
                <div className="w-5 h-5 border-2 border-[--border-secondary] border-t-[--school-primary] rounded-full animate-spin" />
                <p className="text-xs text-[--text-quaternary]">Writing your message…</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
                <p className="text-xs text-red-400">{error}</p>
                <button
                  onClick={() => generateMessage(platform, selectedTone, selectedType)}
                  className="btn-secondary text-xs"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-[--text-secondary] whitespace-pre-wrap">
                {currentMessage}
              </p>
            )}
          </div>

          {/* Char count + regenerate */}
          <div className="flex items-center justify-between -mt-1">
            <button
              onClick={() => generateMessage(platform, selectedTone, selectedType)}
              disabled={isCurrentlyGenerating}
              className="flex items-center gap-1.5 text-xs text-[--text-quaternary] hover:text-[--text-secondary] transition-colors"
            >
              <RefreshCw size={11} className={isCurrentlyGenerating ? 'animate-spin' : ''} />
              Regenerate
            </button>
            {platform === 'linkedin' && currentMessage && (
              <span className={`text-xs tabular-nums ${
                overLimit ? 'text-red-400 font-medium' : 'text-[--text-quaternary]'
              }`}>
                {charCount} / {LINKEDIN_CHAR_LIMIT}
              </span>
            )}
          </div>

          {/* Primary action */}
          {platform === 'linkedin' ? (
            <div className="space-y-2 pt-1">
              {hasLinkedIn ? (
                <button
                  onClick={handleCopyAndOpenLinkedIn}
                  disabled={!currentMessage || isCurrentlyGenerating || overLimit}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3"
                >
                  {isCopied ? (
                    <>
                      <Check size={15} />
                      Copied — opening LinkedIn
                    </>
                  ) : (
                    <>
                      <Linkedin size={15} />
                      Copy & Open LinkedIn
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCopy}
                  disabled={!currentMessage || isCurrentlyGenerating}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3"
                >
                  {isCopied ? <Check size={15} /> : <Copy size={15} />}
                  {isCopied ? 'Copied!' : 'Copy Message'}
                </button>
              )}
              {overLimit && (
                <p className="text-xs text-red-400 text-center">
                  Over the 300 character limit — try regenerating or switching to Formal tone
                </p>
              )}
              <button
                onClick={handleMarkSent}
                disabled={isSending || !currentMessage}
                className="w-full btn-ghost text-xs text-[--text-quaternary] py-2"
              >
                {isSending ? 'Saving…' : 'Mark as sent without copying'}
              </button>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {/* Email actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEmail('gmail')}
                  disabled={!currentMessage || isCurrentlyGenerating}
                  className="flex-1 btn-secondary flex items-center justify-center gap-1.5 text-sm"
                >
                  <Mail size={13} />
                  Gmail
                  <ExternalLink size={10} className="opacity-40" />
                </button>
                <button
                  onClick={() => handleEmail('outlook')}
                  disabled={!currentMessage || isCurrentlyGenerating}
                  className="flex-1 btn-secondary flex items-center justify-center gap-1.5 text-sm"
                >
                  <Mail size={13} />
                  Outlook
                  <ExternalLink size={10} className="opacity-40" />
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!currentMessage || isCurrentlyGenerating}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                onClick={handleMarkSent}
                disabled={isSending || !currentMessage}
                className="w-full btn-ghost text-xs text-[--text-quaternary] py-2"
              >
                {isSending ? 'Saving…' : 'Mark as sent'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
