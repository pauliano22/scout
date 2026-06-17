'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  UserCheck,
} from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  account_role: string
  is_verified: boolean
  is_alumni: boolean
  onboarding_completed: boolean
  created_at: string
}

interface UsersResponse {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [acting, setActing] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (roleFilter) params.set('role', roleFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))

      const res = await fetch(`/api/admin/users?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load users')
      setData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, roleFilter, statusFilter, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleAction = async (userId: string, updates: Record<string, unknown>) => {
    setActing(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Action failed')
      // Refresh the list
      await fetchUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">User Moderation</h1>
        <p className="text-[--text-secondary] text-sm mt-1">
          Manage user accounts, roles, and status
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-tertiary]"
          />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="input-field w-auto min-w-[140px]"
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="alumni">Alumni</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="input-field w-auto min-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="alumni">Is Alumni</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      ) : data && data.users.length === 0 ? (
        <div className="text-center py-16 text-[--text-tertiary]">
          <p className="text-sm">No users found</p>
        </div>
      ) : data ? (
        <>
          {/* Table */}
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-primary]">
                    <th className="text-left px-4 py-3 font-medium text-[--text-tertiary] text-xs uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[--text-tertiary] text-xs uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[--text-tertiary] text-xs uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[--text-tertiary] text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[--text-tertiary] text-xs uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-[--text-tertiary] text-xs uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-primary]">
                  {data.users.map((user) => (
                    <tr key={user.id} className="hover:bg-[--bg-hover] transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {user.full_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-[--text-secondary]">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.account_role === 'admin'
                              ? 'bg-purple-500/10 text-purple-400'
                              : user.account_role === 'alumni'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {user.account_role === 'admin' && <Shield size={12} />}
                          {user.account_role === 'alumni' && <UserCheck size={12} />}
                          {user.account_role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {user.is_verified ? (
                            <CheckCircle size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-amber-500" />
                          )}
                          <span className="text-xs">
                            {user.is_verified ? 'Verified' : 'Unverified'}
                            {user.is_alumni && ' · Alumni'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[--text-tertiary] text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {acting === user.id ? (
                            <Loader2 size={14} className="animate-spin text-[--text-tertiary]" />
                          ) : (
                            <>
                              {!user.is_verified && (
                                <button
                                  onClick={() =>
                                    handleAction(user.id, { is_verified: true })
                                  }
                                  className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                >
                                  Verify
                                </button>
                              )}
                              {user.account_role !== 'admin' && (
                                <button
                                  onClick={() =>
                                    handleAction(user.id, {
                                      account_role: user.account_role === 'student' ? 'alumni' : 'student',
                                    })
                                  }
                                  className="text-xs px-2.5 py-1.5 rounded-md bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors"
                                >
                                  Toggle Role
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <p className="text-[--text-tertiary]">
              Showing {data.users.length} of {data.total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-md bg-[--bg-secondary] border border-[--border-primary] text-sm hover:bg-[--bg-hover] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-[--text-tertiary] px-2">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-md bg-[--bg-secondary] border border-[--border-primary] text-sm hover:bg-[--bg-hover] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
