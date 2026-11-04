const SYSTEM_PROMPT_AR = `أنت مستشار ومخطط مالي ذكي ومحترف.
المستخدم قام بإدخال بيانات ميزانيته الشهرية:
- الدخل الشهري (Monthly Income)
- المصروفات الأساسية الثابتة (Essential Expenses)
- الفائض المتبقي بعد الأساسيات (Remaining discretionary amount)

مهمتك:
1. حساب وتحديد "الميزانية اليومية الموصى بها" (Recommended Daily Budget) للصرف اليومي الحر للمستخدم.
2. عزل نسبة ادخار وطوارئ محكمة (مثلاً 15% إلى 20% من الفائض المتبقي) لحماية المستخدم من الإفلاس أو الطوارئ.
3. تقسيم المبلغ الصافي القابل للصرف على 30 يوماً.
4. تقديم شرح تفصيلي ودقيق ومقنع يوضح للمستخدم:
   - كم هي ميزانيته اليومية؟
   - لماذا تم تحديد هذا الرقم بالتحديد؟ (الأساس المنطقي والمعادلة الحسابية بالتفصيل)
   - خطوات الحسبة بالأرقام خطوة بخطوة.
   - نصائح مالية عملية للالتزام بهذا الحد اليومي.

يجب أن تكون الاستجابة حصراً بصيغة JSON صالحة بالشكل التالي:
{
  "dailyBudget": number (المبلغ اليومي المقترح الصحيح كرقم),
  "safeDailyLimit": number (حد الصرف الآمن للأيام العادية),
  "weekendBuffer": number (مخصص إضافي لعطلة نهاية الأسبوع إن وُجد),
  "monthlySavingsBuffer": number (مبلغ الادخار الشهري الموصى بحمايته وعدم صرفه),
  "reasoning": string (شرح تفصيلي واضح ومنطقي يوضح سبب اختيار هذا الرقم وكيف يوازن بين معيشة المستخدم وادخاره),
  "formulaSteps": [
    {
      "step": string (اسم الخطوة، مثل: "الدخل الشهري الإجمالي"),
      "amount": number (المبلغ),
      "note": string (شرح الخطوة)
    }
  ],
  "tips": [
    string (نصيحة عملية 1),
    string (نصيحة عملية 2),
    string (نصيحة عملية 3)
  ]
}

لا تضع أي نصوص خارج الـ JSON ولا تستخدم markdown code blocks إضافية.`

const SYSTEM_PROMPT_EN = `You are a professional financial planner AI.
The user provided their monthly budget data:
- Monthly Income
- Essential Expenses
- Discretionary remainder

Your task:
1. Calculate a Recommended Daily Budget for the user.
2. Protect a savings/emergency cushion (e.g. 15-20% of discretionary income).
3. Divide the remaining spendable amount by 30 days.
4. Provide a clear, detailed, and mathematically sound explanation of why this specific daily number was chosen and how it is broken down.

Return ONLY valid JSON in this exact structure:
{
  "dailyBudget": number,
  "safeDailyLimit": number,
  "weekendBuffer": number,
  "monthlySavingsBuffer": number,
  "reasoning": string,
  "formulaSteps": [
    {
      "step": string,
      "amount": number,
      "note": string
    }
  ],
  "tips": [
    string,
    string,
    string
  ]
}

No markdown outside JSON.`

export async function POST(req) {
  try {
    const { monthlyIncome, essentialCategories, totalEssentials, remaining, lang = 'ar' } = await req.json()

    const income = Number(monthlyIncome) || 0
    const essentials = Number(totalEssentials) || 0
    const netRemainder = income - essentials

    if (income <= 0) {
      return Response.json({ error: 'Monthly income is required' }, { status: 400 })
    }

    const isAr = lang === 'ar'
    const systemPrompt = isAr ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN

    const apiKey = process.env.OPENROUTER_API_KEY

    // Calculate baseline mathematical fallback
    const savingsRatio = netRemainder > 0 ? 0.20 : 0
    const savingsAmount = Math.max(0, Math.round(netRemainder * savingsRatio))
    const spendablePool = Math.max(0, netRemainder - savingsAmount)
    const fallbackDaily = Math.max(0, Math.round(spendablePool / 30))
    const safeLimit = Math.max(0, Math.round(fallbackDaily * 0.85))
    const weekendExtra = Math.max(0, Math.round(fallbackDaily * 0.3))

    const fallbackResult = {
      dailyBudget: fallbackDaily,
      safeDailyLimit: safeLimit,
      weekendBuffer: weekendExtra,
      monthlySavingsBuffer: savingsAmount,
      reasoning: isAr
        ? `بناءً على دخلك الشهري البالغ ${income.toLocaleString()} جنيه، ومصروفاتك الأساسية البالغة ${essentials.toLocaleString()} جنيه، يتبقى لك فائض قدره ${netRemainder.toLocaleString()} جنيه. قمنا بتخصيص 20% (${savingsAmount.toLocaleString()} جنيه) كادخار وطوارئ لحمايتك، وتوزيع الفائض المتاح (${spendablePool.toLocaleString()} جنيه) على 30 يوماً ليكون حد صرفك اليومي الحر هو ${fallbackDaily.toLocaleString()} جنيه / يوم.`
        : `Based on your monthly income of EGP ${income.toLocaleString()} and essential expenses of EGP ${essentials.toLocaleString()}, you have a net remainder of EGP ${netRemainder.toLocaleString()}. We reserved 20% (EGP ${savingsAmount.toLocaleString()}) for savings/emergencies, distributing the remaining EGP ${spendablePool.toLocaleString()} over 30 days, resulting in a recommended daily spend of EGP ${fallbackDaily.toLocaleString()} / day.`,
      formulaSteps: isAr ? [
        { step: 'الدخل الشهري', amount: income, note: 'إجمالي الدخل المتاح شهرياً' },
        { step: 'المصروفات الأساسية', amount: -essentials, note: 'المصروفات الثابتة والالتزامات الضرورية' },
        { step: 'الفائض المتبقي', amount: netRemainder, note: 'المبلغ المتبقي بعد تغطية الأساسيات' },
        { step: 'مخصص الادخار والطوارئ (20%)', amount: -savingsAmount, note: 'مبلغ محمي للادخار والمستقبل' },
        { step: 'المبلغ المتاح للصرف اليومي', amount: spendablePool, note: 'موزعاً على 30 يوماً بالتساوي' },
      ] : [
        { step: 'Monthly Income', amount: income, note: 'Total available income' },
        { step: 'Essential Expenses', amount: -essentials, note: 'Fixed mandatory obligations' },
        { step: 'Net Discretionary', amount: netRemainder, note: 'Remainder after essentials' },
        { step: 'Savings & Emergency (20%)', amount: -savingsAmount, note: 'Protected cushion' },
        { step: 'Daily Spendable Pool', amount: spendablePool, note: 'Divided over 30 days' },
      ],
      tips: isAr ? [
        `احتفظ بصرفك في الأيام العادية بحدود ${safeLimit.toLocaleString()} جنيه لتوفير مرونة لعطلة نهاية الأسبوع.`,
        `إذا لم تصرف كامل ميزانيتك اليومية، دع الفائض يتراكم في محفظتك ولا تبحث عن سبل لصرفه.`,
        `راجع ميزانيتك أسبوعياً للتأكد من عدم تجاوز المصروفات الأساسية المحددة.`,
      ] : [
        `Keep normal weekday spend around EGP ${safeLimit.toLocaleString()} to leave room for weekends.`,
        `If you spend less than your daily limit, let the surplus accumulate.`,
        `Review your budget weekly to ensure essential categories stay within limits.`,
      ],
    }

    if (!apiKey) {
      return Response.json(fallbackResult)
    }

    const payload = {
      monthlyIncome: income,
      totalEssentials: essentials,
      essentialCategories: (essentialCategories || []).map((c) => ({
        name: c.name,
        amount: Number(c.amount) || 0,
      })),
      netRemainder,
      currency: 'EGP',
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(payload, null, 2) },
          ],
          temperature: 0.25,
          max_tokens: 800,
        }),
      })

      if (!res.ok) {
        console.warn('OpenRouter failed, using fallback calculation:', res.status)
        return Response.json(fallbackResult)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''

      if (!content) {
        return Response.json(fallbackResult)
      }

      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const first = cleaned.indexOf('{')
      const last = cleaned.lastIndexOf('}')

      if (first !== -1 && last !== -1) {
        const parsed = JSON.parse(cleaned.slice(first, last + 1))
        return Response.json({
          dailyBudget: Number(parsed.dailyBudget) || fallbackDaily,
          safeDailyLimit: Number(parsed.safeDailyLimit) || safeLimit,
          weekendBuffer: Number(parsed.weekendBuffer) || weekendExtra,
          monthlySavingsBuffer: Number(parsed.monthlySavingsBuffer) || savingsAmount,
          reasoning: parsed.reasoning || fallbackResult.reasoning,
          formulaSteps: Array.isArray(parsed.formulaSteps) && parsed.formulaSteps.length > 0
            ? parsed.formulaSteps
            : fallbackResult.formulaSteps,
          tips: Array.isArray(parsed.tips) && parsed.tips.length > 0
            ? parsed.tips
            : fallbackResult.tips,
        })
      }

      return Response.json(fallbackResult)
    } catch (apiErr) {
      console.error('Error calling AI endpoint:', apiErr)
      return Response.json(fallbackResult)
    }
  } catch (err) {
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
