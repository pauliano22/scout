'use client'

import { useState, useEffect } from 'react'
import { UserNetwork } from '@/types/database'
import { X, Copy, Check, Linkedin, RefreshCw, Sparkles, Mail } from 'lucide-react'

interface MessageModalProps {
  connection: UserNetwork
  userInterests: string
  userName: string
  userSport: string
  onClose: () => void
  onSend: (connectionId: string, message: string) => Promise<void>
}

type Tone = 'friendly' | 'neutral' | 'formal'

const toneConfig = {
  friendly: { label: 'Friendly', emoji: '😊', description: 'Warm & casual' },
  neutral: { label: 'Neutral', emoji: '🤝', description: 'Balanced' },
  formal: { label: 'Formal', emoji: '👔', description: 'Professional' },
}

export default function MessageModal({
  connection,
  userInterests,
  userName,
  userSport,
  onClose,
  onSend,
}: MessageModalProps) {
  const alumni = connection.alumni
  const [selectedTone, setSelectedTone] = useState<Tone>('neutral')
  const [messages, setMessages] = useState<Record<Tone, string>>({
    friendly: '',
    neutral: '',
    formal: '',
  })
  const [isGenerating, setIsGenerating] = useState<Record<Tone, boolean>>({
    friendly: false,
    neutral: false,
    formal: false,
  })
  const [isSending, setIsSending] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!alumni) return null

  const hasLinkedIn = alumni.linkedin_url && alumni.linkedin_url.trim() !== ''

  // Generate message for a specific tone
  const generateMessage = async (tone: Tone) => {
    setIsGenerating(prev => ({ ...prev, [tone]: true }))
    setError(null)

    try {
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumni,
          userName,
          userSport,
          userInterests,
          tone,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate message')
      }

      const data = await response.json()
      setMessages(prev => ({ ...prev, [tone]: data.message }))
    } catch (err) {
      console.error('Error generating message:', err)
      setError('Failed to generate message. Please try again.')
    } finally {
      setIsGenerating(prev => ({ ...prev, [tone]: false }))
    }
  }

  // Generate initial message on mount
  useEffect(() => {
    if (!messages.neutral) {
      generateMessage('neutral')
    }
  }, [])

  // Generate message when switching to a tone that hasn't been generated yet
  useEffect(() => {
    if (!messages[selectedTone] && !isGenerating[selectedTone]) {
      generateMessage(selectedTone)
    }
  }, [selectedTone])

  const currentMessage = messages[selectedTone]

  const handleCopy = async () => {
    if (!currentMessage) return
    await navigator.clipboard.writeText(currentMessage)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSend = async () => {
    if (!currentMessage) return
    setIsSending(true)
    try {
      await onSend(connection.id, currentMessage)
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyAndOpenLinkedIn = async () => {
    if (!currentMessage) return
    // Copy message to clipboard
    await navigator.clipboard.writeText(currentMessage)
    setIsCopied(true)
    
    // Open LinkedIn profile
    if (alumni.linkedin_url) {
      window.open(alumni.linkedin_url, '_blank')
    }
    
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleOpenEmail = () => {
    if (!currentMessage) return
    const subject = encodeURIComponent(`Cornell ${userSport || 'Athletics'} - Networking Request`)
    const body = encodeURIComponent(currentMessage)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleRegenerate = () => {
    generateMessage(selectedTone)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-6 max-w-lg w-full max-h-[85vh] overflow-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[--school-primary]" />
            <h2 className="text-lg font-semibold">
              Message to {alumni.full_name}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={20} />
          </button>
        </div>

        {/* Tone selector tabs */}
        <div className="flex gap-2 mb-4">
          {(Object.keys(toneConfig) as Tone[]).map((tone) => (
            <button
              key={tone}
              onClick={() => setSelectedTone(tone)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                selectedTone === tone
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-primary]'
              }`}
            >
              <span className="mr-1">{toneConfig[tone].emoji}</span>
              {toneConfig[tone].label}
            </button>
          ))}
        </div>

        {/* Generated message preview */}
        <div className="bg-[--bg-primary] border border-[--border-primary] rounded-lg p-4 mb-4 min-h-[200px]">
          {isGenerating[selectedTone] ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-[--text-tertiary]">
              <div className="w-6 h-6 border-2 border-[--school-primary]/30 border-t-[--school-primary] rounded-full animate-spin mb-3" />
              <p className="text-sm">Generating {toneConfig[selectedTone].label.toLowerCase()} message...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-red-400">
              <p className="text-sm mb-2">{error}</p>
              <button onClick={handleRegenerate} className="btn-secondary text-xs">
                Try Again
              </button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-[--text-secondary] whitespace-pre-wrap">
              {currentMessage}
            </p>
          )}
        </div>

        {/* Regenerate button */}
        <div className="flex justify-between items-center mb-5">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating[selectedTone]}
            className="btn-ghost text-xs flex items-center gap-1 text-[--text-tertiary] hover:text-[--text-primary]"
          >
            <RefreshCw size={12} className={isGenerating[selectedTone] ? 'animate-spin' : ''} />
            Regenerate
          </button>
          <p className="text-[--text-quaternary] text-xs">
            AI-generated • Each message is unique
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end flex-wrap">
          <button
            onClick={handleCopy}
            disabled={!currentMessage || isGenerating[selectedTone]}
            className="btn-secondary flex items-center gap-2"
          >
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            {isCopied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={handleOpenEmail}
            disabled={!currentMessage || isGenerating[selectedTone]}
            className="btn-secondary flex items-center gap-2"
          >
            <Mail size={14} />
            Open in Email
          </button>

          {hasLinkedIn && (
            <button
              onClick={handleCopyAndOpenLinkedIn}
              disabled={!currentMessage || isGenerating[selectedTone]}
              className="btn-secondary flex items-center gap-2 hover:text-[#0077b5]"
            >
              <Linkedin size={14} />
              Open LinkedIn
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={isSending || !currentMessage || isGenerating[selectedTone]}
            className="btn-primary flex items-center gap-2"
          >
            {isSending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Check size={14} />
                Mark as Sent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}