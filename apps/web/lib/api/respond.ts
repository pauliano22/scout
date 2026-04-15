import { NextResponse } from 'next/server'

export type ApiResponse<T> = { data: T; error: null } | { data: null; error: string }

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ data, error: null }, typeof init === 'number' ? { status: init } : init)
}

export function fail(message: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>({ data: null, error: message }, { status })
}
