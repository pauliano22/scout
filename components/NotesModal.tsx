'use client'

import { useState } from 'react'
import { X, Save, StickyNote } from 'lucide-react'
import { UserNetwork } from '@/types/database'

interface NotesModalProps {
  connection: UserNetwork
  onClose: () => void
  onSave: (connectionId: string, notes: string) => Promise<void>
}

export default function NotesModal({ connection, onClose, onSave }: NotesModalProps) {
  const [notes, setNotes] = useState(connection.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const alumni = connection.alumni
  if (!alumni) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(connection.id, notes)
      onClose()
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 max-w-md w-full animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <StickyNote size={18} className="text-amber-400" />
            <h2 className="text-base font-semibold">
              Notes for {alumni.full_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[--text-tertiary] text-xs mb-3">
          {alumni.role} at {alumni.company}
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about your conversation, follow-up items, or anything you want to remember..."
          rows={5}
          autoFocus
          className="input-field resize-none mb-4"
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <>
                <Save size={14} />
                Save Notes
              </>
            )}
          </button>
        </div>

        <p className="text-[--text-quaternary] text-xs mt-3 text-center">
          Press ⌘+Enter to save
        </p>
      </div>
    </div>
  )
}