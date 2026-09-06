import { NextResponse } from 'next/server'
import { initFirebaseAdmin } from '@/lib/firebaseAdmin'

export async function POST(req) {
  console.log('--- [API: /api/notifications/expense] New request received ---')
  try {
    const body = await req.json().catch((err) => {
      console.error('[API Expense Notification] Failed to parse request JSON:', err)
      return {}
    })
    
    const { userId, amount, category, merchant, title, token } = body
    console.log('[API Expense Notification] Request Payload:', {
      userId,
      amount,
      category,
      merchant,
      title,
      hasDirectToken: !!token,
    })

    if (!userId && !token) {
      console.warn('[API Expense Notification] Missing userId and token in request')
      return NextResponse.json(
        { success: false, error: 'userId or token is required' },
        { status: 400 }
      )
    }

    const admin = initFirebaseAdmin()
    const tokens = new Set()

    if (token) {
      tokens.add(token)
      console.log('[API Expense Notification] Added token from request body')
    }

    if (userId) {
      try {
        const db = admin.firestore()
        
        // 1. Get token from user document
        const userDoc = await db.collection('users').doc(userId).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          if (userData?.fcmToken) {
            tokens.add(userData.fcmToken)
            console.log('[API Expense Notification] Found fcmToken on user document:', userData.fcmToken.slice(0, 16) + '...')
          } else {
            console.log('[API Expense Notification] No fcmToken field found on user document')
          }
        } else {
          console.warn('[API Expense Notification] User document does not exist in Firestore for userId:', userId)
        }

        // 2. Get tokens from user fcm_tokens subcollection
        const tokensSnap = await db.collection('users').doc(userId).collection('fcm_tokens').get()
        console.log(`[API Expense Notification] Found ${tokensSnap.size} token document(s) in fcm_tokens subcollection`)
        tokensSnap.forEach((doc) => {
          const tData = doc.data()
          if (tData?.token) {
            tokens.add(tData.token)
          }
        })
      } catch (dbErr) {
        console.error('[API Expense Notification] Error querying Firestore for user tokens:', dbErr.message, dbErr.stack)
      }
    }

    const tokenList = Array.from(tokens).filter(Boolean)
    console.log(`[API Expense Notification] Total unique FCM tokens to send to: ${tokenList.length}`)

    if (tokenList.length === 0) {
      console.warn('[API Expense Notification] No FCM tokens found. Make sure user has enabled notifications in browser.')
      return NextResponse.json({
        success: false,
        message: 'No active FCM tokens found for user. Please ensure notifications are enabled.',
      }, { status: 200 })
    }

    const itemLabel = merchant || title || category || 'مصروف جديد'
    const formattedAmount = Number(amount || 0).toLocaleString('en-US')

    const notificationTitle = '💸 تم تسجيل مصروف جديد'
    const notificationBody = `${itemLabel} - بقيمة ${formattedAmount} ج.م`

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

    if (tokenList.length === 1) {
      console.log('[API Expense Notification] Sending via messaging.send to single token...')
      const response = await admin.messaging().send({
        ...messagePayload,
        token: tokenList[0],
      })
      console.log('[API Expense Notification] Send successful! Message ID:', response)
      return NextResponse.json({
        success: true,
        messageId: response,
        tokensCount: 1,
      })
    } else {
      console.log(`[API Expense Notification] Sending via messaging.sendEachForMulticast to ${tokenList.length} tokens...`)
      const response = await admin.messaging().sendEachForMulticast({
        ...messagePayload,
        tokens: tokenList,
      })
      console.log('[API Expense Notification] Multicast response:', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      })
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`[API Expense Notification] Failed token #${idx}:`, resp.error?.message || resp.error)
          }
        })
      }

      return NextResponse.json({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        tokensCount: tokenList.length,
      })
    }
  } catch (error) {
    console.error('[API Expense Notification] Server Error sending notification:', error.message, error.stack)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send notification',
      },
      { status: 500 }
    )
  }
}
