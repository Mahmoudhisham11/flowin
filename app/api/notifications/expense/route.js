import { NextResponse } from 'next/server'
import { initFirebaseAdmin } from '@/lib/firebaseAdmin'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, amount, category, merchant, title, token } = body

    if (!userId && !token) {
      return NextResponse.json(
        { error: 'userId or token is required' },
        { status: 400 }
      )
    }

    const admin = initFirebaseAdmin()
    const tokens = new Set()

    if (token) {
      tokens.add(token)
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
          }
        }

        // 2. Get tokens from user fcm_tokens subcollection
        const tokensSnap = await db.collection('users').doc(userId).collection('fcm_tokens').get()
        tokensSnap.forEach((doc) => {
          const tData = doc.data()
          if (tData?.token) {
            tokens.add(tData.token)
          }
        })
      } catch (dbErr) {
        console.warn('Could not fetch user FCM tokens from Firestore:', dbErr)
      }
    }

    const tokenList = Array.from(tokens).filter(Boolean)

    if (tokenList.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active FCM tokens found for user',
      })
    }

    const itemLabel = merchant || title || category || 'مصروف'
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
      const response = await admin.messaging().send({
        ...messagePayload,
        token: tokenList[0],
      })
      return NextResponse.json({
        success: true,
        messageId: response,
        tokensCount: 1,
      })
    } else {
      const response = await admin.messaging().sendEachForMulticast({
        ...messagePayload,
        tokens: tokenList,
      })
      return NextResponse.json({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        tokensCount: tokenList.length,
      })
    }
  } catch (error) {
    console.error('Error sending expense notification:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send notification',
      },
      { status: 500 }
    )
  }
}
