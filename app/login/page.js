'use client'

import AuthLayout from '@/components/auth/AuthLayout'
import LoginForm from '@/components/auth/LoginForm'
import styles from './page.module.css'

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <AuthLayout>
        <LoginForm />
      </AuthLayout>
    </div>
  )
}
