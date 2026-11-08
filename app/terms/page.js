import LegalPage from '@/components/legal/LegalPage'
import { termsContent } from '@/lib/legalContent'

export const metadata = { title: 'Terms of use - Flowin' }

export default function TermsPage() {
  return <LegalPage content={termsContent} />
}
