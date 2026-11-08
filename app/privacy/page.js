import LegalPage from '@/components/legal/LegalPage'
import { privacyContent } from '@/lib/legalContent'

export const metadata = { title: 'Privacy policy - Flowin' }

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />
}
