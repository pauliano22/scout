import { Metadata } from 'next'
import JobsClient from './JobsClient'

export const metadata: Metadata = {
  title: 'Job Board | Scout',
  description: 'Discover job opportunities matched to your profile and career interests.',
}

export default function JobsPage() {
  return <JobsClient />
}
