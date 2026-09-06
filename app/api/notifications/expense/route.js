import { NextResponse } from 'next/server'
import { getAdminMessaging, getAdminFirestore } from '@/lib/firebaseAdmin'

export async function sendExpenseNotification({ userId, amount, category, merchant, reason, title, token }) {
  console.log('--- [sendExpenseNotification] Sending for user:', userId, 'amount:', amount)
  const messaging = getAdminMessaging()
  const db = getAdminFirestore()

  const tokensMap = new Map() // token -> docId (to clean up if expired)

  if (token) {
    tokensMap.set(token, null)
  }

  let dailyBudgetLimit = 0
  let todayExpenses = 0

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
        if (uData?.fcmToken && !tokensMap.has(uData.fcmToken)) {
          tokensMap.set(uData.fcmToken, null)
        }
      }

      // 3. Fetch Daily Budget config
      const budgetDoc = await db.collection('users').doc(userId).collection('budget').doc('config').get()
      if (budgetDoc.exists) {
        const bData = budgetDoc.data()
        dailyBudgetLimit = Number(bData?.dailyBudgetLimit || bData?.aiDailyBudget?.dailyBudget || 0)
      }

      // 4. Calculate today's total expenses
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayStartIso = todayStart.toISOString()

      const txSnap = await db
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .where('createdAt', '>=', todayStartIso)
        .get()

      txSnap.forEach((td) => {
        const t = td.data()
        if (t?.type === 'expense') {
          todayExpenses += Number(t.amount || 0)
        }
      })
    } catch (dbErr) {
      console.error('[sendExpenseNotification] DB query error:', dbErr.message)
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
  let notificationBody = `${itemLabel} - بقيمة ${formattedAmount} ج.م`

  if (dailyBudgetLimit > 0) {
    const remaining = dailyBudgetLimit - todayExpenses
    if (todayExpenses > dailyBudgetLimit) {
      const overBy = Math.round(todayExpenses - dailyBudgetLimit).toLocaleString('en-US')
      notificationTitle = '🚨 تجاوزت الميزانية اليومية!'
      notificationBody = `تم تسجيل ${itemLabel} (${formattedAmount} ج.م) - تجاوزت الحد اليومي (${dailyBudgetLimit.toLocaleString('en-US')} ج.م) بمقدار ${overBy} ج.م`
    } else if (todayExpenses >= dailyBudgetLimit * 0.9) {
      // Nearing 10% or less remaining
      const remFormatted = Math.max(0, Math.round(remaining)).toLocaleString('en-US')
      notificationTitle = '⚠️ تنبيه: اقتربت من حد الميزانية اليومية'
      notificationBody = `تم تسجيل ${itemLabel} (${formattedAmount} ج.م) - متبقي ${remFormatted} ج.م فقط من ميزانية اليوم (${dailyBudgetLimit.toLocaleString('en-US')} ج.م)`
    } else {
      const remFormatted = Math.max(0, Math.round(remaining)).toLocaleString('en-US')
      notificationBody = `${itemLabel} - بقيمة ${formattedAmount} ج.م (المتبقي لليوم: ${remFormatted} ج.م)`
    }
  }

  const messagePayload = {
    notification: {
      title: notificationTitle,
      body: notificationBody,
    },
    data: {
      url: '/',
      type: 'expense',
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

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, amount, category, merchant, reason, title, token } = body

    if (!userId && !token) {
      return NextResponse.json(
        { success: false, error: 'userId or token is required' },
        { status: 400 }
      )
    }

    const result = await sendExpenseNotification({
      userId,
      amount,
      category,
      merchant,
      reason,
      title,
      token,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[API /api/notifications/expense] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send notification',
      },
      { status: 500 }
    )
  }
}
