'use client'

import { useState } from 'react'
import { UserNetwork } from '@/types/database'
import { X, Send, Copy, Check, Linkedin } from 'lucide-react'

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

  // Generate personalized message
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-2xl p-8 max-w-xl w-full max-h-[85vh] overflow-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Message to {alumni.full_name}
          </h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors text-2xl"
          >
            <X size={24} />
          </button>
        </div>

        {/* Generated message preview */}
        <div className="bg-black/30 rounded-xl p-5 mb-6 text-sm leading-relaxed text-white/85 whitespace-pre-wrap font-sans">
          {message}
        </div>

        {/* Personalization note */}
        <p className="text-white/40 text-xs mb-6">
          💡 Tip: Update your interests in the settings above to personalize messages further.
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-transparent text-white font-semibold text-sm hover:bg-white/5 transition-all"
          >
            {isCopied ? <Check size={16} /> : <Copy size={16} />}
            {isCopied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cornell-red to-cornell-red-light shadow-lg shadow-cornell-red/40 font-semibold text-sm transition-all hover:shadow-cornell-red/60"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Linkedin size={16} />
                Mark as Sent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
