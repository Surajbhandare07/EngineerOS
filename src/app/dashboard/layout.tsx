import { getUserProfile } from '@/lib/actions/profile'
import DashboardClientLayout from './DashboardClientLayout'

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profileRes: any = await getUserProfile()
  const profile = profileRes.success ? profileRes.data : null

  return (
    <DashboardClientLayout initialProfile={profile}>
      {children}
    </DashboardClientLayout>
  )
}
