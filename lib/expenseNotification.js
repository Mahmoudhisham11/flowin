import { getAdminMessaging, getAdminFirestore } from './firebaseAdmin'
import { currencyLabelAr } from './currency'
import { computeToday, getPeriod, parseDateStr } from './planEngine'
import { resolveTimezone, localDateStr } from './timezone'

export async function sendExpenseNotification({ userId, amount, category, merchant, reason, title, userDate, userTimezone }) {
  console.log('--- [sendExpenseNotification] Sending for user:', userId, 'amount:', amount)
  const messaging = getAdminMessaging()
  const db = getAdminFirestore()

  const tokensMap = new Map() // token -> docId (to clean up if expired)

  let currencyAr = currencyLabelAr()
  let dailyBudgetLimit = 0
  let todayExpenses = 0
  let todayState = null // set when the user has a plan (see lib/planEngine.js)
  let profileTimezone = ''

  if (userId) {
    try {
      // 1. Fetch user fcm_tokens subcollection (multi-device)
      const tokensSnap = await db.collection('users').doc(userId).collection('fcm_tokens').get()
      tokensSnap.forEach((d) => {
        const t = d.data()?.token
        if (t) {
          tokensMap.set(t, d.id)
        }
      })

      // 2. Fetch user document fcmToken if available
      const userDoc = await db.collection('users').doc(userId).get()
      if (userDoc.exists) {
        const uData = userDoc.data()
        currencyAr = currencyLabelAr(uData?.currency)
        profileTimezone = uData?.timezone || ''
        if (uData?.fcmToken && !tokensMap.has(uData.fcmToken)) {
          tokensMap.set(uData.fcmToken, null)
        }
      }

      // 3. Fetch the budget / plan
      const budgetDoc = await db.collection('users').doc(userId).collection('budget').doc('config').get()
      const bData = budgetDoc.exists ? budgetDoc.data() : null
      dailyBudgetLimit = Number(bData?.dailyBudgetLimit || bData?.aiDailyBudget?.dailyBudget || 0)

      // 4. Work out "today" in the user's own timezone
      const tz = resolveTimezone(userTimezone || profileTimezone || 'Africa/Cairo')
      const clientTodayStr = userDate || localDateStr(tz, new Date())

      if (bData?.planVersion) {
        // Plan users: free-spending allowance for today, computed like the Today screen.
        const now = parseDateStr(clientTodayStr) || parseDateStr(localDateStr(tz, new Date()))
        const period = getPeriod(bData, now)
        const sinceIso = new Date(period.start.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

        const txSnap = await db
          .collection('users')
          .doc(userId)
          .collection('transactions')
          .where('createdAt', '>=', sinceIso)
          .get()

        const txs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        todayState = computeToday(bData, txs, now, (iso) => parseDateStr(localDateStr(tz, new Date(iso))))
      } else {
        // Legacy users (manual daily limit): all of today's expenses against the limit.
        const fallbackIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
        const txSnap = await db
          .collection('users')
          .doc(userId)
          .collection('transactions')
          .where('createdAt', '>=', fallbackIso)
          .get()

        let calculatedExpenses = 0
        txSnap.forEach((td) => {
          const t = td.data()
          if (t?.type === 'expense') {
            const tDate = t.createdAt ? new Date(t.createdAt) : null
            if (tDate && !isNaN(tDate.getTime()) && localDateStr(tz, tDate) === clientTodayStr) {
              calculatedExpenses += Number(t.amount || 0)
            }
          }
        })
        todayExpenses = calculatedExpenses
        if (amount && todayExpenses < Number(amount)) {
          todayExpenses = Number(amount)
        }
      }
    } catch (dbErr) {
      console.error('[sendExpenseNotification] DB query error:', dbErr.message)
      if (amount) {
        todayExpenses = Number(amount)
      }
    }
  }

  const tokenList = Array.from(tokensMap.keys()).filter(Boolean)
  console.log(`[sendExpenseNotification] Found ${tokenList.length} unique FCM token(s) for user ${userId}`)

  if (tokenList.length === 0) {
    return {
      success: false,
      message: 'No active FCM tokens found for user',
    }
  }

  const itemLabel = merchant || reason || title || category || 'مصروف جديد'
  const formattedAmount = Number(amount || 0).toLocaleString('en-US')

  // Smart Budget Warning Check
  let notificationTitle = '💸 تم تسجيل مصروف جديد'
  let notificationBody = `${itemLabel} - بقيمة ${formattedAmount} ${currencyAr}`

  const fmtNum = (n) => Math.max(0, Math.round(n)).toLocaleString('en-US')

  if (todayState?.hasPlan && todayState.status !== 'none') {
    const t = todayState
    const spent = `${itemLabel} (${formattedAmount} ${currencyAr})`
    if (t.status === 'depleted') {
      notificationTitle = '🚨 خلصت فلوس الصرف الحر'
      notificationBody = `تم تسجيل ${spent} - خلص رصيد الصرف الحر لفترة القبض دي، وفاضل ${t.daysLeft} يوم لحد القبض`
    } else if (t.status === 'over') {
      notificationTitle = '🚨 تجاوزت حد النهارده'
      notificationBody = `تم تسجيل ${spent} - تجاوزت حد النهارده (${fmtNum(t.todayAllowance)} ${currencyAr}) بمقدار ${fmtNum(-t.remainingToday)} ${currencyAr}. حد بكرة هيبقى ${fmtNum(t.tomorrowAllowance)} ${currencyAr}`
    } else if (t.status === 'caution') {
      notificationTitle = '⚠️ تنبيه: اقتربت من حد النهارده'
      notificationBody = `تم تسجيل ${spent} - متبقي ${fmtNum(t.remainingToday)} ${currencyAr} فقط من حد النهارده (${fmtNum(t.todayAllowance)} ${currencyAr})`
    } else {
      notificationBody = `${itemLabel} - بقيمة ${formattedAmount} ${currencyAr} (تقدر تصرف النهارده: ${fmtNum(t.remainingToday)} ${currencyAr})`
    }
    // Purchases that only paid a fixed expense (e.g. rent) do not use up free money: keep the plain message.
  } else if (dailyBudgetLimit > 0) {
    const remaining = dailyBudgetLimit - todayExpenses
    if (todayExpenses > dailyBudgetLimit) {
      const overBy = Math.round(todayExpenses - dailyBudgetLimit).toLocaleString('en-US')
      notificationTitle = '🚨 تجاوزت الميزانية اليومية!'
      notificationBody = `تم تسجيل ${itemLabel} (${formattedAmount} ${currencyAr}) - تجاوزت الحد اليومي (${dailyBudgetLimit.toLocaleString('en-US')} ${currencyAr}) بمقدار ${overBy} ${currencyAr}`
    } else if (todayExpenses >= dailyBudgetLimit * 0.9) {
      // Nearing 10% or less remaining
      const remFormatted = Math.max(0, Math.round(remaining)).toLocaleString('en-US')
      notificationTitle = '⚠️ تنبيه: اقتربت من حد الميزانية اليومية'
      notificationBody = `تم تسجيل ${itemLabel} (${formattedAmount} ${currencyAr}) - متبقي ${remFormatted} ${currencyAr} فقط من ميزانية اليوم (${dailyBudgetLimit.toLocaleString('en-US')} ${currencyAr})`
    } else {
      const remFormatted = Math.max(0, Math.round(remaining)).toLocaleString('en-US')
      notificationBody = `${itemLabel} - بقيمة ${formattedAmount} ${currencyAr} (المتبقي لليوم: ${remFormatted} ${currencyAr})`
    }
  }

  const notificationId = `expense_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const messagePayload = {
    notification: {
      title: notificationTitle,
      body: notificationBody,
    },
    data: {
      url: '/',
      type: 'expense',
      notificationId: notificationId,
      amount: String(amount || 0),
      category: String(category || ''),
      title: String(itemLabel),
      dailyBudgetLimit: String(dailyBudgetLimit),
      todayExpenses: String(todayExpenses),
    },
    webpush: {
      notification: {
        title: notificationTitle,
        body: notificationBody,
        icon: '/web-app-manifest-192x192.png',
        badge: '/favicon-96x96.png',
        tag: notificationId,
        renotify: false,
      },
      fcmOptions: {
        link: '/',
      },
    },
  }

  // Multicast send to all user devices
  const response = await messaging.sendEachForMulticast({
    ...messagePayload,
    tokens: tokenList,
  })

  console.log('[sendExpenseNotification] Multicast result:', {
    total: tokenList.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  })

  // Clean up unregistered / dead tokens
  if (response.failureCount > 0 && userId) {
    const expiredTokens = []
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code || ''
        console.warn(`[sendExpenseNotification] Token #${idx} failed:`, errCode, resp.error?.message)
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token'
        ) {
          const badToken = tokenList[idx]
          const docId = tokensMap.get(badToken)
          if (docId) {
            expiredTokens.push(docId)
          }
        }
      }
    })

    if (expiredTokens.length > 0) {
      console.log(`[sendExpenseNotification] Cleaning up ${expiredTokens.length} expired token doc(s)...`)
      Promise.all(
        expiredTokens.map((docId) =>
          db.collection('users').doc(userId).collection('fcm_tokens').doc(docId).delete().catch(() => {})
        )
      ).catch(() => {})
    }
  }

  return {
    success: true,
    successCount: response.successCount,
    failureCount: response.failureCount,
    tokensCount: tokenList.length,
  }
}
