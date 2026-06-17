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

  const handleVerify = async (userId: string, verified: boolean) => {
    setActing(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_verified: verified }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update user')
      fetchUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const handleChangeRole = async (userId: string, role: string) => {
    setActing(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_role: role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update user')
      fetchUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-500/10 text-purple-500',
      alumni: 'bg-emerald-500/10 text-emerald-500',
      student: 'bg-blue-500/10 text-blue-500',
    }
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors[role] || 'bg-gray-500/10 text-gray-500'}`}>
        {role}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Users</h1>
        <p className="text-sm text-[--text-secondary] mt-1">Moderate user accounts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-tertiary]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder:text-[--text-tertiary] focus:outline-none focus:border-[--school-primary]"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] focus:outline-none focus:border-[--school-primary]"
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="alumni">Alumni</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] focus:outline-none focus:border-[--school-primary]"
        >
          <option value="">All Status</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="alumni">Alumni</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      )}

      {/* User table */}
      {!loading && data && (
        <>
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-primary] text-left">
                    <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Joined</th>
                    <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-primary]">
                  {data.users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-[--text-tertiary]">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    data.users.map((user) => (
                      <tr key={user.id} className="hover:bg-[--bg-hover]/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[--text-primary]">{user.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-[--text-tertiary]">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">{roleBadge(user.account_role)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {user.is_verified ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-500">
                                <CheckCircle size={12} /> Verified
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-500">
                                <XCircle size={12} /> Unverified
                              </span>
                            )}
                            {user.is_alumni && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">Alumni</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[--text-tertiary]">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleVerify(user.id, !user.is_verified)}
                              disabled={acting === user.id}
                              className={`p-1.5 rounded text-xs transition-colors ${
                                user.is_verified
                                  ? 'text-amber-500 hover:bg-amber-500/10'
                                  : 'text-emerald-500 hover:bg-emerald-500/10'
                              } disabled:opacity-50`}
                              title={user.is_verified ? 'Unverify' : 'Verify'}
                            >
                              {acting === user.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <UserCheck size={14} />
                              )}
                            </button>
                            {user.account_role !== 'admin' && (
                              <button
                                onClick={() => handleChangeRole(user.id, user.account_role === 'student' ? 'alumni' : 'student')}
                                disabled={acting === user.id}
                                className="p-1.5 rounded text-xs text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                title={`Change to ${user.account_role === 'student' ? 'alumni' : 'student'}`}
                              >
                                <Shield size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-[--text-tertiary]">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
