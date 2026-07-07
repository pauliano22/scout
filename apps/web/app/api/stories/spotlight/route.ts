import { NextResponse } from 'next/server'

const stories = [
  {
    name: 'Sarah Chen',
    sport: 'Ice Hockey',
    industry: 'Finance',
    quote: 'Scout connected me with a fellow Cornell hockey alum who became my mentor at Goldman.',
    photoUrl: '/brand/placeholder-1.svg',
  },
  {
    name: 'Marcus Williams',
    sport: 'Football',
    industry: 'Tech',
    quote: 'Found my co-founder through Scout — we were teammates on the 2018 football roster.',
    photoUrl: '/brand/placeholder-2.svg',
  },
  {
    name: 'Emily Rodriguez',
    sport: 'Soccer',
    industry: 'Healthcare',
    quote: 'The alumni network helped me land my dream residency through a connection from my soccer team.',
    photoUrl: '/brand/placeholder-3.svg',
  },
  {
    name: 'James Park',
    sport: 'Swimming',
    industry: 'Consulting',
    quote: 'Three McKinsey alums from my swim team reviewed my case prep. I got the offer.',
    photoUrl: '/brand/placeholder-4.svg',
  },
]

export async function GET() {
  return NextResponse.json(stories)
}
