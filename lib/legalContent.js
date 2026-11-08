// Plain-language privacy policy and terms. They describe what the app actually does today;
// have them reviewed by a lawyer before relying on them commercially.
// Set NEXT_PUBLIC_SUPPORT_EMAIL to show a contact address on both pages.

export const LEGAL_UPDATED = '2026-11-08'

export const privacyContent = {
  en: {
    title: 'Privacy policy',
    intro: 'Flowin helps you plan and control your spending. This page explains what we store, why, and the choices you have.',
    sections: [
      { h: 'What we store', p: [
        'Account: your name, email address and how you sign in (email and password, or Google). Sign-in is handled by Google Firebase Authentication.',
        'What you enter: wallets and balances, transactions (amount, category, shop or reason, date), your income and fixed expenses, savings goals and tasks.',
        'Preferences: language, theme, currency and time zone.',
        'Notifications: if you allow them, a device token so we can send you push notifications.',
        'Shortcut token: if you create one, we keep only a one-way hash of it, never the token itself.',
        'Subscription: your plan, its dates, and the phone number and payment reference you send when you ask to upgrade.',
      ] },
      { h: 'Where it is kept and who can see it', p: [
        'Your data is stored in Google Firestore under your account. Security rules allow only you to read and change your financial data.',
        'The admin panel shows account and plan details only (name, email, plan, dates). It does not show your transactions, wallets or goals.',
      ] },
      { h: 'AI features', p: [
        'When you chat with the money manager or add expenses by voice, the text needed to answer is sent to an AI provider (OpenRouter, which routes to the model that serves your request). For the chat this includes your first name, your plan figures, recent transactions and their notes, goals and wallet balances. We do not sell this data and do not use it for advertising.',
        'Voice input uses your browser’s speech recognition. Depending on your browser, the audio may be processed by the browser vendor.',
        'AI answers are generated automatically and are not professional financial advice.',
      ] },
      { h: 'Your choices', p: [
        'Download: Settings > Privacy & data > Download my data gives you a JSON file with your information.',
        'Delete: Settings > Privacy & data > Delete my account permanently removes your profile, wallets, transactions, plan, goals, tasks, notification tokens, shortcut token, upgrade requests and your sign-in. This cannot be undone.',
        'You can switch off notifications in your browser settings at any time.',
      ] },
      { h: 'Cookies and local storage', p: [
        'We store your language and theme choice in your browser. Firebase keeps your sign-in session in your browser so you stay signed in.',
      ] },
      { h: 'Changes', p: ['If we change how we handle your data we will update this page and its date.'] },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    intro: 'فلوين بيساعدك تخطط وتتحكم في صرفك. الصفحة دي بتشرح إيه اللي بنحفظه وليه، وإيه اللي تقدر تعمله.',
    sections: [
      { h: 'إيه اللي بنحفظه', p: [
        'الحساب: اسمك وبريدك الإلكتروني وطريقة الدخول (بريد وكلمة مرور، أو جوجل). تسجيل الدخول بيتم عن طريق Google Firebase Authentication.',
        'اللي بتدخله: المحافظ والأرصدة، والمعاملات (المبلغ والنوع والمكان أو السبب والتاريخ)، ودخلك ومصاريفك الثابتة، وأهداف الادخار والمهام.',
        'التفضيلات: اللغة والمظهر والعملة والمنطقة الزمنية.',
        'الإشعارات: لو سمحت بيها، بنحفظ رمز جهازك عشان نبعتلك إشعارات.',
        'رمز الاختصار السريع: لو عملته، بنحفظ بس بصمة مشفرة منه ومش الرمز نفسه.',
        'الاشتراك: خطتك وتواريخها ورقم الموبايل ومرجع الدفع اللي بتبعتهم لما تطلب الترقية.',
      ] },
      { h: 'فين بتتخزن ومين يقدر يشوفها', p: [
        'بياناتك بتتخزن في Google Firestore تحت حسابك. قواعد الأمان بتسمح لك إنت بس تقرا وتعدل بياناتك المالية.',
        'لوحة الإدارة بتعرض بيانات الحساب والخطة بس (الاسم والبريد والخطة والتواريخ). مبتعرضش معاملاتك أو محافظك أو أهدافك.',
      ] },
      { h: 'مميزات الذكاء الاصطناعي', p: [
        'لما تتكلم مع المدير المالي أو تضيف مصروف بالصوت، بنبعت النص اللازم للإجابة لمزوّد ذكاء اصطناعي (OpenRouter، اللي بيوجّه الطلب للنموذج المناسب). في الشات ده بيشمل اسمك الأول وأرقام خطتك وآخر معاملاتك وملاحظاتها وأهدافك وأرصدة محافظك. مش بنبيع البيانات دي ومش بنستخدمها في الإعلانات.',
        'الإدخال الصوتي بيستخدم التعرف على الكلام في متصفحك. حسب متصفحك، ممكن الصوت يتعالج عند الشركة المطورة للمتصفح.',
        'إجابات الذكاء الاصطناعي بتتولّد أوتوماتيك وليست استشارة مالية احترافية.',
      ] },
      { h: 'اختياراتك', p: [
        'التنزيل: الإعدادات > الخصوصية وبياناتك > نزّل بياناتي بيدّيك ملف JSON بمعلوماتك.',
        'الحذف: الإعدادات > الخصوصية وبياناتك > احذف حسابي بيمسح نهائيًا ملفك الشخصي ومحافظك ومعاملاتك وخطتك وأهدافك ومهامك ورموز الإشعارات ورمز الاختصار وطلبات الترقية وتسجيل دخولك. مفيش رجوع.',
        'تقدر توقف الإشعارات من إعدادات المتصفح في أي وقت.',
      ] },
      { h: 'الكوكيز والتخزين المحلي', p: [
        'بنحفظ اختيار اللغة والمظهر في متصفحك. وFirebase بيحتفظ بجلسة دخولك في المتصفح عشان تفضل مسجّل.',
      ] },
      { h: 'التغييرات', p: ['لو غيّرنا طريقة التعامل مع بياناتك هنحدّث الصفحة دي وتاريخها.'] },
    ],
  },
}

export const termsContent = {
  en: {
    title: 'Terms of use',
    intro: 'By using Flowin you agree to these terms.',
    sections: [
      { h: 'What Flowin is', p: [
        'Flowin is a planning and tracking tool. It is not a bank, does not hold your money and does not move money between your real accounts. Balances and goals are records you keep.',
      ] },
      { h: 'Not financial advice', p: [
        'Daily amounts, verdicts, reports and AI answers are calculations based on the numbers you enter. They are general guidance, not professional financial, tax or legal advice. You are responsible for your own financial decisions.',
      ] },
      { h: 'Your account', p: [
        'Keep your sign-in details safe and enter accurate information. You can download or delete your data at any time from Settings.',
      ] },
      { h: 'Plans and payment', p: [
        'New accounts get a 7-day free trial. After that, continuing to use the app requires the Pro plan. Upgrades are requested in the app and activated after we confirm your payment. A Pro plan period lasts 30 days from activation.',
      ] },
      { h: 'Acceptable use', p: [
        'Do not misuse the service, try to access other people’s data, overload it with automated requests, or use it for anything unlawful. We may limit or suspend accounts that do.',
      ] },
      { h: 'Availability', p: [
        'We work to keep Flowin running and accurate, but it is provided as is, without guarantees. Features may change over time.',
      ] },
    ],
  },
  ar: {
    title: 'شروط الاستخدام',
    intro: 'باستخدامك فلوين إنت موافق على الشروط دي.',
    sections: [
      { h: 'فلوين إيه', p: [
        'فلوين أداة للتخطيط والتتبع. مش بنك، ومبيحتفظش بفلوسك، ومبيحوّلش فلوس بين حساباتك الحقيقية. الأرصدة والأهداف سجلات إنت بتحتفظ بيها.',
      ] },
      { h: 'مش استشارة مالية', p: [
        'الأرقام اليومية والأحكام والتقارير وإجابات الذكاء الاصطناعي حسابات مبنية على الأرقام اللي بتدخلها. دي إرشادات عامة مش استشارة مالية أو ضريبية أو قانونية احترافية. إنت المسؤول عن قراراتك المالية.',
      ] },
      { h: 'حسابك', p: [
        'حافظ على بيانات دخولك وأدخل معلومات صحيحة. تقدر تنزّل بياناتك أو تحذفها في أي وقت من الإعدادات.',
      ] },
      { h: 'الخطط والدفع', p: [
        'الحسابات الجديدة بتاخد تجربة مجانية 7 أيام. بعدها استمرار الاستخدام محتاج خطة Pro. الترقية بتتطلب من جوه التطبيق وبتتفعل بعد ما نتأكد من الدفع. فترة Pro مدتها 30 يوم من التفعيل.',
      ] },
      { h: 'الاستخدام المقبول', p: [
        'متسيئش استخدام الخدمة، ومتحاولش توصل لبيانات غيرك، ومتضغطش عليها بطلبات آلية، ومتستخدمهاش في حاجة مخالفة للقانون. ممكن نحدّ أو نوقف الحسابات اللي بتعمل كده.',
      ] },
      { h: 'التوافر', p: [
        'بنشتغل عشان فلوين يفضل شغال ودقيق، بس بيتقدم كما هو من غير ضمانات. المميزات ممكن تتغير مع الوقت.',
      ] },
    ],
  },
}
