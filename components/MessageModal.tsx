'use client'

import { useState } from 'react'
import { UserNetwork } from '@/types/database'
import { X, Copy, Check, Linkedin } from 'lucide-react'

interface MessageModalProps {
  connection: UserNetwork
  userInterests: string
  userName: string
  userSport: string
  onClose: () => void
  onSend: (connectionId: string, message: string) => Promise<void>
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
  const [isSending, setIsSending] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  if (!alumni) return null

  const generateMessage = () => {
    const firstName = alumni.full_name.split(' ')[0]
    return `Hi ${firstName},

I hope this message finds you well! My name is ${userName || '[Your Name]'}, and I'm a current student-athlete at Cornell on the ${userSport || '[Your Sport]'} team.

I came across your profile and was really inspired by your journey from Cornell Athletics to ${alumni.company}. As someone deeply interested in ${userInterests || '[your interests]'}, I'd love to learn more about your path to becoming a ${alumni.role}.

Would you have 15-20 minutes for a brief call sometime in the next few weeks? I'd be grateful for any insights you could share about breaking into ${alumni.industry?.toLowerCase() || 'your industry'}.

Thank you so much for your time, and Go Big Red!

Best regards,
${userName || '[Your Name]'}
Cornell ${userSport || '[Sport]'}`
  }

  const message = generateMessage()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      await onSend(connection.id, message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111113] border border-[#27272a] rounded-xl p-6 max-w-lg w-full max-h-[85vh] overflow-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">
            Message to {alumni.full_name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Generated message preview */}
        <div className="bg-[#0a0a0b] border border-[#27272a] rounded-lg p-4 mb-4 text-sm leading-relaxed text-[#a1a1aa] whitespace-pre-wrap">
          {message}
        </div>

        {/* Personalization note */}
        <p className="text-[#52525b] text-xs mb-5">
          Tip: Update your interests in settings to personalize messages further.
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCopy}
            className="btn-secondary flex items-center gap-2"
          >
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            {isCopied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={handleSend}
            disabled={isSending}
            className="btn-primary flex items-center gap-2"
          >
            {isSending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Linkedin size={14} />
                Mark as Sent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}