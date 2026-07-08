'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Send, Users, QrCode, Smartphone, Loader2 } from 'lucide-react'

interface SessionInfo {
  id: string
  code: string
  name: string
  sport: string
  is_active: boolean
  qr_code_url: string | null
}

interface Message {
  id: string
  user_id: string
  display_name: string | null
  content: string
  created_at: string
}

export default function EventPage() {
  const params = useParams()
  const code = typeof params === 'object' && params !== null ? (params.code as string) || '' : ''

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [joined, setJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load session info on mount
  useEffect(() => {
    const load = async () => {
      try {
        // Try to join first (will return session info even if already joined)
        const joinRes = await fetch('/api/event/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        if (!joinRes.ok) {
          const err = await joinRes.json()
          throw new Error(err.error || 'Failed to load event')
        }

        const joinData = await joinRes.json()
        setSession(joinData.session)
        setJoined(true)
        setLoading(false)

        // Load messages
        await loadMessages()
      } catch (e) {
        // If join fails, try just loading session info
        try {
          const msgRes = await fetch(`/api/event/messages?code=${code}`)
          if (msgRes.ok) {
            const data = await msgRes.json()
            setSession(data.session)
            setJoined(true)
            setMessages(data.messages || [])
            setParticipantCount(data.participant_count || 0)
            setLoading(false)
            return
          }
        } catch {
          // Session might not exist — show landing
        }

        // Show the session as not joined
        try {
          // Try to get basic session info via messages endpoint (will 403 if not joined, but we can at least try)
          setSession({
            id: '',
            code,
            name: 'Event',
            sport: '',
            is_active: true,
            qr_code_url: null,
          })
          setJoined(false)
        } finally {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [code])

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/event/messages?code=${code}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setParticipantCount(data.participant_count || 0)
        setSession(data.session)
        scrollToBottom()
      }
    } catch {
      // Silently fail — will retry on poll
    }
  }

  // Start polling after joining
  useEffect(() => {
    if (!joined) return

    // Initial load
    loadMessages()

    // Poll every 5 seconds
    pollRef.current = setInterval(loadMessages, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [joined, code, scrollToBottom])

  const handleJoin = async () => {
    setJoining(true)
    setError(null)

    try {
      const res = await fetch('/api/event/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join')
      }

      setSession(data.session)
      setJoined(true)
      setParticipantCount(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join event')
    } finally {
      setJoining(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/event/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, content: input.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }

      setInput('')
      await loadMessages()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[--bg-primary] flex items-center justify-center">
        <Loader2 className="animate-spin text-[--text-quaternary]" size={32} />
      </div>
    )
  }

  // Landing / join page (before joining)
  if (!joined) {
    return (
      <div className="min-h-screen bg-[--bg-primary] flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 bg-[--bg-secondary] rounded-2xl flex items-center justify-center mb-6 border border-[--border-primary]">
            <QrCode size={36} className="text-[--school-primary]" />
          </div>

          <h1 className="text-3xl font-bold mb-3 tracking-tight">
            {session?.name || 'Event Chat'}
          </h1>

          {session?.sport && (
            <p className="text-[--text-secondary] mb-6">
              {session.sport} Event
            </p>
          )}

          <p className="text-[--text-secondary] mb-8 max-w-sm">
            Join the temporary group chat for this event. Connect with other alumni and fans in real time.
          </p>

          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-6 mb-8 w-full">
            <div className="flex items-center gap-3 mb-3">
              <Smartphone size={18} className="text-[--school-primary]" />
              <span className="text-sm font-medium">Scan to connect</span>
            </div>
            <p className="text-xs text-[--text-quaternary] text-left">
              Share this QR code at the event and anyone who scans it joins this temporary chat.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6 w-full">
              {error}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {joining ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Users size={16} />
            )}
            {joining ? 'Joining...' : 'Join Event Chat'}
          </button>
        </main>
      </div>
    )
  }

  // Chat UI (after joining)
  return (
    <div className="min-h-screen bg-[--bg-primary] flex flex-col">
      {/* Header */}
      <header className="border-b border-[--border-primary] px-4 py-3 flex items-center justify-between bg-[--bg-secondary]">
        <div>
          <h1 className="font-semibold text-base">{session?.name || 'Event Chat'}</h1>
          <p className="text-xs text-[--text-quaternary] flex items-center gap-1.5">
            <Users size={12} />
            {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session?.qr_code_url && (
            <button
              onClick={() => window.open(session.qr_code_url!, '_blank')}
              className="p-2 rounded-lg hover:bg-[--bg-tertiary] transition-colors"
              title="View QR Code"
            >
              <QrCode size={18} className="text-[--text-secondary]" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[--text-quaternary] text-sm">
              No messages yet. Be the first to say something!
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[--school-primary]">
                {msg.display_name || 'Anonymous'}
              </span>
              <span className="text-xs text-[--text-quaternary]">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-[--text-primary] whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[--border-primary] px-4 py-3 bg-[--bg-secondary]">
        <form
          onSubmit={handleSend}
          className="flex gap-2 max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={2000}
            disabled={sending || !session?.is_active}
            className="flex-1 bg-[--bg-primary] border border-[--border-primary] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[--school-primary] transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending || !session?.is_active}
            className="btn-primary p-2.5 rounded-xl disabled:opacity-50"
          >
            {sending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
        {!session?.is_active && (
          <p className="text-xs text-[--text-quaternary] text-center mt-2">
            This event session has ended. Messages can no longer be sent.
          </p>
        )}
      </div>
    </div>
  )
}
