'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firestore'
import { useUser } from '@/contexts/UserContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTranslation } from '@/hooks/useTranslation'
import { getBudget, saveBudget } from '@/services/budgetService'
import { CURRENCIES, normalizeCurrency } from '@/lib/currency'
import { getPeriod, computePlan, recommendSavingsPct, toDateStr, PAY_CYCLES } from '@/lib/planEngine'
import { ESSENTIAL_PRESETS, WEAK_SPOTS, SAVINGS_OPTIONS } from '@/lib/planPresets'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import styles from './page.module.css'

const TOTAL_STEPS = 5
let idCounter = 0
const newId = () => `r${++idCounter}`

// Accepts Arabic-Indic digits and stray characters; returns a non-negative number.
function toNum(value) {
  const normalized = String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.]/g, '')
  const n = parseFloat(normalized)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

export default function OnboardingPage() {
  const router = useRouter()
  const { user, userData, updateUserData } = useUser()
  const { lang, setLang } = useLocale()
  const { t } = useTranslation()

  const isEdit = Boolean(userData?.onboardingCompleted)

  const [step, setStep] = useState(0)
  const [currency, setCurrency] = useState(normalizeCurrency(userData?.currency))
  const [incomeType, setIncomeType] = useState('fixed')
  const [payCycle, setPayCycle] = useState('monthly')
  const [payDay, setPayDay] = useState('1')
  const [lastPayDate, setLastPayDate] = useState('')
  const [sources, setSources] = useState(() => [{ id: newId(), name: '', amount: '' }])
  const [presetAmounts, setPresetAmounts] = useState({}) // presetId -> amount string (key present = selected)
  const [customs, setCustoms] = useState([]) // [{ id, name, amount, spent }]
  const [spentByKey, setSpentByKey] = useState({})
  const [savingsPct, setSavingsPct] = useState(null) // null = not chosen yet -> use the suggestion
  const [customPct, setCustomPct] = useState('')
  const [weakSpots, setWeakSpots] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const prefilled = useRef(false)

  // Pre-fill from an existing budget so current users only confirm/adjust.
  useEffect(() => {
    if (!user || prefilled.current) return
    prefilled.current = true
    let cancelled = false

    getBudget(user.uid)
      .then((b) => {
        if (cancelled || !b) return
        if (b.incomeType === 'variable') setIncomeType('variable')
        if (PAY_CYCLES.includes(b.payCycle)) setPayCycle(b.payCycle)
        if (b.payDay) setPayDay(String(b.payDay))
        if (b.lastPayDate) setLastPayDate(b.lastPayDate)

        const src = Array.isArray(b.incomeSources) && b.incomeSources.length > 0
          ? b.incomeSources
          : Number(b.monthlyIncome) > 0
            ? [{ name: '', amount: b.monthlyIncome }]
            : []
        if (src.length > 0) {
          setSources(src.map((s) => ({ id: newId(), name: s.name || '', amount: String(s.amount ?? '') })))
        }

        if (typeof b.savingsPct === 'number') setSavingsPct(b.savingsPct)
        if (Array.isArray(b.weakSpots)) setWeakSpots(b.weakSpots)

        const presets = {}
        const customList = []
        const spent = {}
        ;(b.essentialCategories || []).forEach((c) => {
          const preset = ESSENTIAL_PRESETS.find(
            (p) => p.id === c.presetId || p.labelEn === c.name || p.labelAr === c.name
          )
          if (preset && presets[preset.id] === undefined) {
            presets[preset.id] = String(c.amount ?? '')
            spent[preset.id] = Number(c.spent) || 0
          } else {
            const id = newId()
            customList.push({ id, name: c.name || '', amount: String(c.amount ?? ''), categoryId: c.categoryId })
            spent[id] = Number(c.spent) || 0
          }
        })
        setPresetAmounts(presets)
        setCustoms(customList)
        setSpentByKey(spent)
      })
      .catch((err) => console.warn('[onboarding] could not load existing plan:', err))

    return () => { cancelled = true }
  }, [user])

  const period = useMemo(
    () => getPeriod({ payCycle, payDay: toNum(payDay), lastPayDate }),
    [payCycle, payDay, lastPayDate]
  )

  const essentialItems = useMemo(
    () => [
      ...Object.entries(presetAmounts).map(([id, amount]) => ({ id, amount: toNum(amount) })),
      ...customs.map((c) => ({ id: c.id, amount: toNum(c.amount) })),
    ],
    [presetAmounts, customs]
  )

  const incomeSources = useMemo(
    () => sources.map((s) => ({ name: s.name, amount: toNum(s.amount) })),
    [sources]
  )

  const baseTotals = computePlan({ incomeSources, essentials: essentialItems, savingsPct: 0 }, period)
  const suggestedPct = recommendSavingsPct(baseTotals.income, baseTotals.essentials)
  const effectivePct = savingsPct ?? suggestedPct
  const plan = computePlan({ incomeSources, essentials: essentialItems, savingsPct: effectivePct }, period)

  const incomeStepValid =
    plan.income > 0 &&
    (payCycle === 'monthly' ? toNum(payDay) >= 1 && toNum(payDay) <= 31 : Boolean(lastPayDate))

  const blocking = plan.warnings.find((w) => w === 'essentialsExceedIncome' || w === 'savingsTooHigh')

  const canNext = (() => {
    if (step === 1) return incomeStepValid
    if (step === 2) return plan.income > 0 && plan.warnings[0] !== 'essentialsExceedIncome'
    if (step === 3) return !blocking
    return true
  })()

  const cycleSuffix = { monthly: t('onboarding.perMonth'), biweekly: t('onboarding.perBiweekly'), weekly: t('onboarding.perWeek') }[payCycle]

  const updateSource = (id, field, value) =>
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))

  const togglePreset = (id) =>
    setPresetAmounts((prev) => {
      const next = { ...prev }
      if (next[id] !== undefined) delete next[id]
      else next[id] = ''
      return next
    })

  const handleFinish = async () => {
    if (!user || saving) return
    setSaving(true)
    setError('')
    try {
      const essentialCategories = [
        ...Object.entries(presetAmounts)
          .filter(([, amount]) => toNum(amount) > 0)
          .map(([id, amount]) => {
            const preset = ESSENTIAL_PRESETS.find((p) => p.id === id)
            const entry = {
              name: lang === 'ar' ? preset.labelAr : preset.labelEn,
              amount: toNum(amount),
              spent: spentByKey[id] || 0,
              presetId: id,
            }
            if (preset.categoryId) entry.categoryId = preset.categoryId
            return entry
          }),
        ...customs
          .filter((c) => c.name.trim() && toNum(c.amount) > 0)
          .map((c) => {
            const entry = { name: c.name.trim(), amount: toNum(c.amount), spent: spentByKey[c.id] || 0 }
            if (c.categoryId) entry.categoryId = c.categoryId
            return entry
          }),
      ]

      const defaultName = t('onboarding.defaultSource')
      await saveBudget(user.uid, {
        monthlyIncome: plan.income,
        incomeType,
        payCycle,
        payDay: payCycle === 'monthly' ? Math.min(31, Math.max(1, Math.floor(toNum(payDay)))) : null,
        lastPayDate: payCycle === 'monthly' ? null : lastPayDate,
        incomeSources: incomeSources
          .filter((s) => s.amount > 0)
          .map((s) => ({ name: s.name.trim() || defaultName, amount: s.amount })),
        essentialCategories,
        savingsPct: plan.savingsPct,
        weakSpots,
        planVersion: 1,
        planUpdatedAt: new Date().toISOString(),
      })

      const profile = {
        currency,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      }
      await updateDoc(doc(db, 'users', user.uid), profile)
      updateUserData(profile)
      router.replace('/')
    } catch (err) {
      console.error('[onboarding] save failed:', err)
      setError(t('onboarding.saveError'))
      setSaving(false)
    }
  }

  const goNext = () => (step === TOTAL_STEPS - 1 ? handleFinish() : setStep((s) => s + 1))
  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const today = toDateStr(new Date())

  const planPreview = (
    <div className={styles.preview}>
      <div className={styles.previewTitle}>{t('onboarding.planTitle')}</div>
      <div className={styles.bar} aria-hidden="true">
        {plan.income > 0 && (
          <>
            <span className={styles.barEss} style={{ width: `${Math.min(100, (plan.essentials / plan.income) * 100)}%` }} />
            <span className={styles.barSave} style={{ width: `${Math.min(100, (plan.savings / plan.income) * 100)}%` }} />
            <span className={styles.barFree} style={{ width: `${Math.max(0, (plan.free / plan.income) * 100)}%` }} />
          </>
        )}
      </div>
      <dl className={styles.rows}>
        <div><dt>{t('onboarding.income')}</dt><dd>{currency} {fmt(plan.income)}</dd></div>
        <div><dt><i className={styles.dotEss} />{t('onboarding.essentials')}</dt><dd>− {fmt(plan.essentials)}</dd></div>
        <div><dt><i className={styles.dotSave} />{t('onboarding.savings')} ({plan.savingsPct}%)</dt><dd>− {fmt(plan.savings)}</dd></div>
        <div className={styles.rowTotal}><dt><i className={styles.dotFree} />{t('onboarding.freeSpend')}</dt><dd>{currency} {fmt(plan.free)}</dd></div>
      </dl>
      {plan.free > 0 && (
        <div className={styles.allowance}>
          <div><strong>{currency} {fmt(plan.dailyAllowance)}</strong><span>{t('onboarding.perDay')}</span></div>
          <div><strong>{currency} {fmt(plan.weeklyAllowance)}</strong><span>{t('onboarding.perWeekShort')}</span></div>
          <div><strong>{period.totalDays}</strong><span>{t('onboarding.periodDays')}</span></div>
        </div>
      )}
      {plan.warnings.length > 0 && (
        <p className={`${styles.warning} ${plan.warnings[0] === 'tight' ? styles.warnSoft : ''}`} role="alert">
          {t(`onboarding.warn.${plan.warnings[0]}`)}
        </p>
      )}
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.progressText}>
            {isEdit && step === 0 ? t('onboarding.editTitle') : `${t('onboarding.stepOf')} ${step + 1} ${t('onboarding.of')} ${TOTAL_STEPS}`}
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>
        </header>

        <main className={styles.card}>
          {step === 0 && (
            <section>
              <h1 className={styles.title}>{t('onboarding.welcomeTitle')}</h1>
              <p className={styles.sub}>{t('onboarding.welcomeSub')}</p>

              <div className={styles.field}>
                <label className={styles.label}>{t('onboarding.language')}</label>
                <div className={styles.segment}>
                  {[['ar', 'العربية'], ['en', 'English']].map(([code, label]) => (
                    <button key={code} type="button" className={`${styles.segBtn} ${lang === code ? styles.segActive : ''}`} onClick={() => setLang(code)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('onboarding.currency')}</label>
                <Select
                  value={currency}
                  onChange={setCurrency}
                  options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${lang === 'ar' ? c.nameAr : c.nameEn}` }))}
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className={styles.title}>{t('onboarding.incomeTitle')}</h1>
              <p className={styles.sub}>{t('onboarding.incomeSub')}</p>

              <div className={styles.field}>
                <label className={styles.label}>{t('onboarding.incomeType')}</label>
                <div className={styles.cards2}>
                  {['fixed', 'variable'].map((type) => (
                    <button key={type} type="button" className={`${styles.choice} ${incomeType === type ? styles.choiceActive : ''}`} onClick={() => setIncomeType(type)}>
                      <strong>{t(`onboarding.${type}`)}</strong>
                      <span>{t(`onboarding.${type}Desc`)}</span>
                    </button>
                  ))}
                </div>
                {incomeType === 'variable' && <p className={styles.hint}>{t('onboarding.variableHint')}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('onboarding.payCycle')}</label>
                <div className={styles.segment}>
                  {PAY_CYCLES.map((c) => (
                    <button key={c} type="button" className={`${styles.segBtn} ${payCycle === c ? styles.segActive : ''}`} onClick={() => setPayCycle(c)}>
                      {t(`onboarding.${c}`)}
                    </button>
                  ))}
                </div>
              </div>

              {payCycle === 'monthly' ? (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="payDay">{t('onboarding.payDay')}</label>
                  <input id="payDay" className={styles.input} type="number" inputMode="numeric" min="1" max="31" value={payDay} onChange={(e) => setPayDay(e.target.value)} />
                </div>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="lastPay">{t('onboarding.lastPayDate')}</label>
                  <input id="lastPay" className={styles.input} type="date" max={today} value={lastPayDate} onChange={(e) => setLastPayDate(e.target.value)} />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>{t('onboarding.incomeSources')} ({cycleSuffix})</label>
                {sources.map((s) => (
                  <div key={s.id} className={styles.sourceRow}>
                    <input className={styles.input} type="text" placeholder={t('onboarding.sourceName')} value={s.name} onChange={(e) => updateSource(s.id, 'name', e.target.value)} />
                    <div className={styles.amountWrap}>
                      <span>{currency}</span>
                      <input className={styles.amountInput} type="text" inputMode="decimal" placeholder={t('onboarding.sourceAmount')} value={s.amount} onChange={(e) => updateSource(s.id, 'amount', e.target.value)} aria-label={t('onboarding.sourceAmount')} />
                    </div>
                    {sources.length > 1 && (
                      <button type="button" className={styles.remove} onClick={() => setSources((prev) => prev.filter((x) => x.id !== s.id))} aria-label="Remove">×</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.linkBtn} onClick={() => setSources((prev) => [...prev, { id: newId(), name: '', amount: '' }])}>
                  + {t('onboarding.addSource')}
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className={styles.title}>{t('onboarding.essentialsTitle')}</h1>
              <p className={styles.sub}>{t('onboarding.essentialsSub')} ({cycleSuffix})</p>

              <div className={styles.presetList}>
                {ESSENTIAL_PRESETS.map((p) => {
                  const selected = presetAmounts[p.id] !== undefined
                  return (
                    <div key={p.id} className={`${styles.presetRow} ${selected ? styles.presetOn : ''}`}>
                      <button type="button" className={styles.presetToggle} onClick={() => togglePreset(p.id)} aria-pressed={selected}>
                        <span className={styles.emoji}>{p.emoji}</span>
                        <span>{lang === 'ar' ? p.labelAr : p.labelEn}</span>
                      </button>
                      {selected && (
                        <div className={styles.amountWrap}>
                          <span>{currency}</span>
                          <input className={styles.amountInput} type="text" inputMode="decimal" placeholder="0" value={presetAmounts[p.id]} autoFocus onChange={(e) => setPresetAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))} aria-label={lang === 'ar' ? p.labelAr : p.labelEn} />
                        </div>
                      )}
                    </div>
                  )
                })}

                {customs.map((c) => (
                  <div key={c.id} className={`${styles.presetRow} ${styles.presetOn}`}>
                    <input className={styles.input} type="text" placeholder={t('onboarding.customName')} value={c.name} onChange={(e) => setCustoms((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                    <div className={styles.amountWrap}>
                      <span>{currency}</span>
                      <input className={styles.amountInput} type="text" inputMode="decimal" placeholder="0" value={c.amount} onChange={(e) => setCustoms((prev) => prev.map((x) => (x.id === c.id ? { ...x, amount: e.target.value } : x)))} aria-label={t('onboarding.sourceAmount')} />
                    </div>
                    <button type="button" className={styles.remove} onClick={() => setCustoms((prev) => prev.filter((x) => x.id !== c.id))} aria-label="Remove">×</button>
                  </div>
                ))}
              </div>

              <button type="button" className={styles.linkBtn} onClick={() => setCustoms((prev) => [...prev, { id: newId(), name: '', amount: '' }])}>
                + {t('onboarding.addCustom')}
              </button>

              <div className={styles.totalLine}>
                <span>{t('onboarding.essentialsTotal')}</span>
                <strong>{currency} {fmt(plan.essentials)}</strong>
              </div>
              {plan.warnings[0] === 'essentialsExceedIncome' && <p className={styles.warning} role="alert">{t('onboarding.warn.essentialsExceedIncome')}</p>}
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className={styles.title}>{t('onboarding.savingsTitle')}</h1>
              <p className={styles.sub}>{t('onboarding.savingsSub')}</p>

              <div className={styles.pctRow}>
                {SAVINGS_OPTIONS.map((pct) => (
                  <button key={pct} type="button" className={`${styles.pct} ${effectivePct === pct && customPct === '' ? styles.pctActive : ''}`} onClick={() => { setSavingsPct(pct); setCustomPct('') }}>
                    {pct}%
                    {pct === suggestedPct && <small>{t('onboarding.recommended')}</small>}
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="customPct">{t('onboarding.customPct')}</label>
                <input id="customPct" className={styles.input} type="number" inputMode="numeric" min="0" max="100" value={customPct} placeholder={String(effectivePct)} onChange={(e) => { setCustomPct(e.target.value); if (e.target.value !== '') setSavingsPct(Math.min(100, Math.max(0, Number(e.target.value) || 0))) }} />
              </div>

              {planPreview}
            </section>
          )}

          {step === 4 && (
            <section>
              <h1 className={styles.title}>{t('onboarding.weakTitle')}</h1>
              <p className={styles.sub}>{t('onboarding.weakSub')}</p>
              <div className={styles.chips}>
                {WEAK_SPOTS.map((w) => {
                  const on = weakSpots.includes(w.id)
                  return (
                    <button key={w.id} type="button" aria-pressed={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={() => setWeakSpots((prev) => (on ? prev.filter((x) => x !== w.id) : [...prev, w.id]))}>
                      <span className={styles.emoji}>{w.emoji}</span>
                      {lang === 'ar' ? w.labelAr : w.labelEn}
                    </button>
                  )
                })}
              </div>
              {planPreview}
            </section>
          )}

          {error && <p className={styles.warning} role="alert">{error}</p>}
        </main>

        <footer className={styles.footer}>
          {step > 0 ? (
            <Button variant="secondary" onClick={goBack} disabled={saving}>{t('onboarding.back')}</Button>
          ) : <span />}
          <Button onClick={goNext} disabled={!canNext} loading={saving}>
            {step === TOTAL_STEPS - 1 ? t('onboarding.finish') : t('onboarding.next')}
          </Button>
        </footer>
      </div>
    </div>
  )
}
