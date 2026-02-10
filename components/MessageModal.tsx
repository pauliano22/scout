'use client'

import { useState, useEffect } from 'react'
import { UserNetwork } from '@/types/database'
import { X, Copy, Check, Linkedin, RefreshCw, Sparkles, Mail, ExternalLink } from 'lucide-react'

interface MessageModalProps {
  connection: UserNetwork
  userSport: string
  onClose: () => void
  onSend: (connectionId: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => Promise<void>
}

type Tone = 'friendly' | 'neutral' | 'formal'
type MessageType = 'introduction' | 'follow_up' | 'thank_you'

const toneConfig = {
  friendly: { label: 'Friendly', emoji: '😊', description: 'Warm & casual' },
  neutral: { label: 'Neutral', emoji: '🤝', description: 'Balanced' },
  formal: { label: 'Formal', emoji: '👔', description: 'Professional' },
}

const messageTypeConfig = {
  introduction: { label: 'Introduction', description: 'First outreach to connect' },
  follow_up: { label: 'Follow Up', description: 'Check in after initial contact' },
  thank_you: { label: 'Thank You', description: 'After a call or meeting' },
}

export default function MessageModal({
  connection,
  userSport,
  onClose,
  onSend,
}: MessageModalProps) {
  const alumni = connection.alumni
  const [selectedTone, setSelectedTone] = useState<Tone>('neutral')
  const [selectedType, setSelectedType] = useState<MessageType>('introduction')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({})
  const [isSending, setIsSending] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!alumni) return null

  const hasLinkedIn = alumni.linkedin_url && alumni.linkedin_url.trim() !== ''

  // Generate message for a specific tone and type combination
  const generateMessage = async (tone: Tone, type: MessageType) => {
    const key = `${type}_${tone}`
    setIsGenerating(prev => ({ ...prev, [key]: true }))
    setError(null)

    try {
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumni,
          tone,
          messageType: type,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate message')
      }

      const data = await response.json()
      setMessages(prev => ({ ...prev, [key]: data.message }))
    } catch (err) {
      console.error('Error generating message:', err)
      setError('Failed to generate message. Please try again.')
    } finally {
      setIsGenerating(prev => ({ ...prev, [key]: false }))
    }
  }

  const currentKey = `${selectedType}_${selectedTone}`

  // Generate initial message on mount
  useEffect(() => {
    const key = `${selectedType}_${selectedTone}`
    if (!messages[key] && !isGenerating[key]) {
      generateMessage(selectedTone, selectedType)
    }
  }, [])

  // Generate message when switching to a tone/type that hasn't been generated yet
  useEffect(() => {
    if (!messages[currentKey] && !isGenerating[currentKey]) {
      generateMessage(selectedTone, selectedType)
    }
  }, [selectedTone, selectedType])

  const currentMessage = messages[currentKey]

  const handleCopy = async () => {
    if (!currentMessage) return
    await navigator.clipboard.writeText(currentMessage)
    setIsCopied(true)

    // Track the copy action
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

  const handleCopyAndOpenLinkedIn = async () => {
    if (!currentMessage) return
    // Copy message to clipboard
    await navigator.clipboard.writeText(currentMessage)
    setIsCopied(true)

    // Track the LinkedIn action
    await onSend(connection.id, currentMessage, 'linkedin')

    // Open LinkedIn profile
    if (alumni.linkedin_url) {
      window.open(alumni.linkedin_url, '_blank')
    }

    setTimeout(() => {
      setIsCopied(false)
      onClose()
    }, 1000)
  }

  const handleOpenGmail = async () => {
    if (!currentMessage) return

    // Track the email action
    await onSend(connection.id, currentMessage, 'email')

    const subject = encodeURIComponent(`Cornell ${userSport || 'Athletics'} - Networking Request`)
    const body = encodeURIComponent(currentMessage)
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${alumni.email || ''}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')

    setTimeout(() => onClose(), 500)
  }

  const handleOpenOutlook = async () => {
    if (!currentMessage) return

    // Track the email action
    await onSend(connection.id, currentMessage, 'email')

    const subject = encodeURIComponent(`Cornell ${userSport || 'Athletics'} - Networking Request`)
    const body = encodeURIComponent(currentMessage)
    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${alumni.email || ''}&subject=${subject}&body=${body}`
    window.open(outlookUrl, '_blank')

    setTimeout(() => onClose(), 500)
  }

  const handleRegenerate = () => {
    generateMessage(selectedTone, selectedType)
  }

  const isCurrentlyGenerating = isGenerating[currentKey]

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

        {/* Message type selector */}
        <div className="mb-3">
          <label className="text-xs text-[--text-tertiary] mb-1.5 block">Message Type</label>
          <div className="flex gap-2">
            {(Object.keys(messageTypeConfig) as MessageType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === type
                    ? 'bg-[--school-primary] text-white'
                    : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-primary]'
                }`}
              >
                {messageTypeConfig[type].label}
              </button>
            ))}
          </div>
        </div>

        {/* Tone selector tabs */}
        <div className="mb-4">
          <label className="text-xs text-[--text-tertiary] mb-1.5 block">Tone</label>
          <div className="flex gap-2">
            {(Object.keys(toneConfig) as Tone[]).map((tone) => (
              <button
                key={tone}
                onClick={() => setSelectedTone(tone)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedTone === tone
                    ? 'bg-[--school-primary]/80 text-white'
                    : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-primary]'
                }`}
              >
                <span className="mr-1">{toneConfig[tone].emoji}</span>
                {toneConfig[tone].label}
              </button>
            ))}
          </div>
        </div>

        {/* Generated message preview */}
        <div className="bg-[--bg-primary] border border-[--border-primary] rounded-lg p-4 mb-4 min-h-[200px]">
          {isCurrentlyGenerating ? (
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
            disabled={isCurrentlyGenerating}
            className="btn-ghost text-xs flex items-center gap-1 text-[--text-tertiary] hover:text-[--text-primary]"
          >
            <RefreshCw size={12} className={isCurrentlyGenerating ? 'animate-spin' : ''} />
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
            disabled={!currentMessage || isCurrentlyGenerating}
            className="btn-secondary flex items-center gap-2"
          >
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            {isCopied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={handleOpenGmail}
            disabled={!currentMessage || isCurrentlyGenerating}
            className="btn-secondary flex items-center gap-2"
            title="Opens Gmail in a new tab"
          >
            <Mail size={14} />
            Gmail
            <ExternalLink size={10} className="opacity-50" />
          </button>

          <button
            onClick={handleOpenOutlook}
            disabled={!currentMessage || isCurrentlyGenerating}
            className="btn-secondary flex items-center gap-2"
            title="Opens Outlook in a new tab"
          >
            <Mail size={14} />
            Outlook
            <ExternalLink size={10} className="opacity-50" />
          </button>

          {hasLinkedIn && (
            <button
              onClick={handleCopyAndOpenLinkedIn}
              disabled={!currentMessage || isCurrentlyGenerating}
              className="btn-secondary flex items-center gap-2 hover:text-[#0077b5]"
            >
              <Linkedin size={14} />
              Open LinkedIn
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={isSending || !currentMessage || isCurrentlyGenerating}
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
