'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import { useTranslation } from '@/hooks/useTranslation'
import { submitUpgradeRequest } from '@/services/pendingUpgradesService'
import PlanCard from './PlanCard'
import styles from './PricingModal.module.css'

const VODAFONE_NUMBER = '01097025743'
const PRO_PRICE = '99.99'

const PLANS = {
  free: {
    price: '0',
    period: null,
    cta: 'Start Free Trial',
    features: [
      '7 days full access',
      'Track income & expenses',
      'Multi-wallet support',
      'Basic reports',
      'Community support',
    ],
  },
  pro: {
    price: PRO_PRICE,
    period: 'mo',
    cta: 'Subscribe Now',
    features: [
      'Everything in Free',
      'Unlimited AI voice parsing',
      'AI financial chat assistant',
      'Weekly AI insights',
      'Receipt scanning',
      'Advanced analytics & reports',
      'Priority support',
    ],
  },
}

export default function PricingModal({ open, onClose }) {
  const { userData } = useUser()
  const { isFree, isPro, isAdmin, daysLeft } = useSubscription()
  const { lang, isAr } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [step, setStep] = useState('plan')
  const [userPhone, setUserPhone] = useState('')
  const [refId, setRefId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const overlayRef = useRef(null)

  const isRtl = lang === 'ar'

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setAnimate(true))
    } else {
      setAnimate(false)
      setStep('plan')
      setUserPhone('')
      setRefId('')
      setError('')
      setSuccess(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!userData?.uid || !userPhone || !refId) return
    setLoading(true)
    setError('')
    try {
      await submitUpgradeRequest({
        uid: userData.uid,
        email: userData.email || '',
        phone: userPhone,
        refId,
        amount: PRO_PRICE,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message || isAr ? 'حدث خطأ' : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const freePlan = {
    ...PLANS.free,
    name: isAr ? 'مجاني' : 'Free',
    desc: isAr ? 'ابدأ مع نسخة تجريبية مجانية لمدة 7 أيام' : 'Get started with a 7-day free trial',
    cta: isFree ? (daysLeft > 0 ? `${daysLeft} ${isAr ? 'يوم متبقي' : 'days left'}` : isAr ? 'منتهي' : 'Expired') : isAr ? 'ابدأ الآن' : 'Start Free Trial',
    features: isAr
      ? ['7 أيام وصول كامل', 'تتبع الدخل والمصروفات', 'دعم المحافظ المتعددة', 'تقارير أساسية', 'دعم المجتمع']
      : PLANS.free.features,
  }

  const proPlan = {
    ...PLANS.pro,
    name: isAr ? 'برو' : 'Pro',
    desc: isAr ? 'افتح كل الميزات مع Flowin Pro' : 'Unlock everything with Flowin Pro',
    cta: isPro ? (isAr ? 'مشترك' : 'Subscribed') : isAr ? 'اشترك الآن' : 'Subscribe Now',
    features: isAr
      ? ['كل ميزات المجاني', 'تحليل صوتي غير محدود بالذكاء الاصطناعي', 'مساعد دردشة مالي', 'رؤى أسبوعية بالذكاء الاصطناعي', 'مسح الإيصالات', 'تحليلات وتقارير متقدمة', 'دعم أولوي']
      : PLANS.pro.features,
  }

  const renderPlans = () => (
    <>
      <div className={styles.header}>
        <h2 className={styles.title}>{isAr ? 'اختر خطتك' : 'Choose Your Plan'}</h2>
        <p className={styles.subtitle}>{isAr ? 'افتح الميزات المميزة وطور إدارتك المالية' : 'Unlock premium features and level up your financial game'}</p>
      </div>

      {isAdmin && (
        <div className={styles.adminNote}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{isAr ? 'أنت مشرف - لديك وصول كامل لجميع الميزات' : 'You are an admin — full access to all features'}</span>
        </div>
      )}

      <div className={styles.grid}>
        <PlanCard plan={freePlan} isPopular={false} onSelect={onClose} isActive={isFree || isAdmin} loading={false} iconType="free" />
        <PlanCard plan={proPlan} isPopular={true} onSelect={() => setStep('payment')} isActive={isPro || isAdmin} loading={false} iconType="pro" />
      </div>
    </>
  )

  const renderPayment = () => (
    <>
      <div className={styles.header}>
        <h2 className={styles.title}>{isAr ? 'الدفع عبر فودافون كاش' : 'Pay via Vodafone Cash'}</h2>
        <p className={styles.subtitle}>{isAr ? 'حول المبلغ إلى الرقم التالي ثم أرسل بيانات التحويل' : 'Transfer the amount to the number below, then submit the transfer details'}</p>
      </div>

      <div className={styles.vodafoneCard}>
        <div className={styles.vodafoneIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className={styles.vodafoneDetails}>
          <span className={styles.vodafoneLabel}>{isAr ? 'رقم المحفظة' : 'Wallet Number'}</span>
          <span className={styles.vodafoneNumber}>{VODAFONE_NUMBER}</span>
        </div>
        <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(VODAFONE_NUMBER) }}>
          {isAr ? 'نسخ' : 'Copy'}
        </button>
      </div>

      <div className={styles.amountBox}>
        <span className={styles.amountLabel}>{isAr ? 'المبلغ' : 'Amount'}</span>
        <span className={styles.amountValue}>{PRO_PRICE} $</span>
      </div>

      <div className={styles.instructions}>
        <p>{isAr
          ? '١. افتح تطبيق فودافون كاش على هاتفك'
          : '1. Open the Vodafone Cash app on your phone'}
        </p>
        <p>{isAr
          ? '٢. حول المبلغ إلى الرقم أعلاه'
          : '2. Transfer the amount to the number above'}
        </p>
        <p>{isAr
          ? '٣. أدخل بيانات التحويل بالأسفل وأرسل'
          : '3. Enter the transfer details below and submit'}
        </p>
      </div>

      <div className={styles.formFields}>
        <input
          className={styles.input}
          type="tel"
          placeholder={isAr ? 'رقم هاتفك المسجل في فودافون كاش' : 'Your Vodafone Cash phone number'}
          value={userPhone}
          onChange={(e) => setUserPhone(e.target.value)}
        />
        <input
          className={styles.input}
          type="text"
          placeholder={isAr ? 'رقم العملية / الإشارة (Ref ID)' : 'Transaction Reference ID'}
          value={refId}
          onChange={(e) => setRefId(e.target.value)}
        />
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
      {success && (
        <div className={styles.successMsg}>
          {isAr
            ? 'تم إرسال طلب الترقية! سيتم تفعيل الحساب بعد التحقق من الدفع'
            : 'Upgrade request submitted! Your account will be activated after payment verification'}
        </div>
      )}

      {!success && (
        <button className={styles.payBtn} onClick={handleSubmit} disabled={loading || !userPhone || !refId}>
          {loading ? <span className={styles.spinner} /> : isAr ? 'تأكيد الدفع' : 'Confirm Payment'}
        </button>
      )}

      {success && (
        <button className={styles.payBtn} onClick={onClose}>
          {isAr ? 'تم' : 'Done'}
        </button>
      )}
    </>
  )

  return (
    <div
      className={`${styles.overlay} ${animate ? styles.overlayVisible : ''}`}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <div className={`${styles.modal} ${animate ? styles.modalVisible : ''}`}>
        <div className={styles.handle} />
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {step === 'plan' && renderPlans()}
        {step === 'payment' && renderPayment()}
      </div>
    </div>
  )
}
