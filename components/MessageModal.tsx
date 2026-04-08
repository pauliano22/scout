'use client'

import { useState, useEffect } from 'react'
import { UserNetwork } from '@/types/database'
import { X, Copy, Check, Linkedin, RefreshCw, Mail, ExternalLink } from 'lucide-react'

interface MessageModalProps {
  connection: UserNetwork
  userSport: string
  onClose: () => void
  onSend: (connectionId: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => Promise<void>
}

type Tone        = 'friendly' | 'neutral' | 'formal'
type MessageType = 'introduction' | 'follow_up' | 'thank_you'

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

export default function MessageModal({ connection, userSport, onClose, onSend }: MessageModalProps) {
  const alumni = connection.alumni
  const [selectedTone, setSelectedTone] = useState<Tone>('neutral')
  const [selectedType, setSelectedType] = useState<MessageType>('introduction')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({})
  const [isSending, setIsSending] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!alumni) return null

  const currentKey = `${selectedType}_${selectedTone}`
  const currentMessage = messages[currentKey]
  const isCurrentlyGenerating = !!isGenerating[currentKey]

  const generateMessage = async (tone: Tone, type: MessageType) => {
    const key = `${type}_${tone}`
    setIsGenerating(p => ({ ...p, [key]: true }))
    setError(null)
    try {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumni, tone, messageType: type }),
      })
      if (!res.ok) throw new Error('Failed to generate message')
      const data = await res.json()
      setMessages(p => ({ ...p, [key]: data.message }))
    } catch {
      setError('Failed to generate. Please try again.')
    } finally {
      setIsGenerating(p => ({ ...p, [key]: false }))
    }
  }

  useEffect(() => {
    if (!messages[currentKey] && !isGenerating[currentKey]) {
      generateMessage(selectedTone, selectedType)
    }
  }, [selectedTone, selectedType])

  useEffect(() => {
    generateMessage(selectedTone, selectedType)
  }, [])

  const handleCopy = async () => {
    if (!currentMessage) return
    await navigator.clipboard.writeText(currentMessage)
    setIsCopied(true)
    await onSend(connection.id, currentMessage, 'copied')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSend = async () => {
    if (!currentMessage) return
    setIsSending(true)
    try {
      await onSend(connection.id, currentMessage, 'marked')
      onClose()
    } finally {
      setIsSending(false)
    }
  }

  const handleOpenLinkedIn = async () => {
    if (!currentMessage) return
    await navigator.clipboard.writeText(currentMessage)
    await onSend(connection.id, currentMessage, 'linkedin')
    if (alumni.linkedin_url) window.open(alumni.linkedin_url, '_blank')
    setTimeout(() => onClose(), 600)
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
    window.open(url, '_blank')
    setTimeout(() => onClose(), 500)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[--bg-primary] border border-[--border-primary] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-auto animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[--border-primary]">
          <div>
            <h2 className="text-base font-semibold text-[--text-primary]">Write to {alumni.full_name}</h2>
            <p className="text-xs text-[--text-quaternary] mt-0.5">AI-generated · each message is unique</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 -mr-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type + Tone in one row */}
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
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 min-h-[180px]">
            {isCurrentlyGenerating ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
                <div className="w-5 h-5 border-2 border-[--border-secondary] border-t-[--school-primary] rounded-full animate-spin" />
                <p className="text-xs text-[--text-quaternary]">Generating…</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
                <p className="text-xs text-red-400">{error}</p>
                <button onClick={() => generateMessage(selectedTone, selectedType)} className="btn-secondary text-xs">Try Again</button>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-[--text-secondary] whitespace-pre-wrap">{currentMessage}</p>
            )}
          </div>

          {/* Regenerate */}
          <div className="flex justify-start">
            <button
              onClick={() => generateMessage(selectedTone, selectedType)}
              disabled={isCurrentlyGenerating}
              className="flex items-center gap-1.5 text-xs text-[--text-quaternary] hover:text-[--text-secondary] transition-colors"
            >
              <RefreshCw size={11} className={isCurrentlyGenerating ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleCopy}
              disabled={!currentMessage || isCurrentlyGenerating}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {isCopied ? 'Copied!' : 'Copy'}
            </button>

            <button
              onClick={() => handleEmail('gmail')}
              disabled={!currentMessage || isCurrentlyGenerating}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <Mail size={12} />
              Gmail
              <ExternalLink size={9} className="opacity-40" />
            </button>

            <button
              onClick={() => handleEmail('outlook')}
              disabled={!currentMessage || isCurrentlyGenerating}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <Mail size={12} />
              Outlook
              <ExternalLink size={9} className="opacity-40" />
            </button>

            {alumni.linkedin_url && (
              <button
                onClick={handleOpenLinkedIn}
                disabled={!currentMessage || isCurrentlyGenerating}
                className="btn-secondary flex items-center gap-1.5 text-xs hover:text-[#0077b5]"
              >
                <Linkedin size={12} />
                LinkedIn
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={isSending || !currentMessage || isCurrentlyGenerating}
              className="btn-primary flex items-center gap-1.5 text-xs ml-auto"
            >
              {isSending ? (
                <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Mark as Sent
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
