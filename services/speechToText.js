export default class SpeechToTextService {
  constructor() {
    this.recognition = null
    this.stopped = false
    this._onEnd = null
    this._ended = false
    this._finalText = ''
    this._silenceTimer = null
  }

  start({ onResult, onError, onEnd, language = 'ar-EG' }) {
    const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
    if (!SR) {
      onError(new Error('Speech recognition is not supported in this browser'))
      return
    }

    this.stopped = false
    this._ended = false
    this._onEnd = onEnd
    this._finalText = ''

    try {
      this.recognition = new SR()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = language
    } catch (err) {
      onError(err)
      return
    }

    const resetSilenceTimer = () => {
      if (this._silenceTimer) clearTimeout(this._silenceTimer)
      this._silenceTimer = setTimeout(() => {
        if (this._finalText.trim()) {
          this.stop()
        }
      }, 3500)
    }

    this.recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i]
        const text = item[0]?.transcript || ''
        if (item.isFinal) {
          finalTranscript += text + ' '
        } else {
          interimTranscript += text
        }
      }

      this._finalText = finalTranscript.trim()
      const currentInterim = interimTranscript.trim()

      onResult({
        final: this._finalText,
        interim: currentInterim,
      })

      if (this._finalText || currentInterim) {
        resetSilenceTimer()
      }
    }

    this.recognition.onerror = (event) => {
      if (this.stopped) return
      if (this._silenceTimer) clearTimeout(this._silenceTimer)

      if (event.error === 'no-speech') {
        if (!this._finalText.trim()) {
          onError(new Error('لم يتم اكتشاف كلام - No speech detected'))
        }
      } else if (event.error === 'aborted') {
        return
      } else if (event.error === 'not-allowed') {
        onError(new Error('تم رفض إذن الميكروفون - Microphone access denied'))
      } else if (event.error === 'language-not-supported') {
        onError(new Error(`اللغة "${language}" غير مدعومة في هذا المتصفح`))
      } else {
        onError(new Error(event.error))
      }
    }

    this.recognition.onend = () => {
      if (this._silenceTimer) clearTimeout(this._silenceTimer)
      this._triggerEnd(onError)
    }

    try {
      this.recognition.start()
      resetSilenceTimer()
    } catch (err) {
      onError(err)
    }
  }

  _triggerEnd(onError) {
    if (this._ended) return
    this._ended = true

    const text = this._finalText.trim()
    if (text) {
      this._onEnd?.(text)
    } else if (!this.stopped && onError) {
      onError(new Error('لم يتم التعرف على كلام - No speech recognized'))
    }
  }

  stop() {
    this.stopped = true
    if (this._silenceTimer) clearTimeout(this._silenceTimer)
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {}
    }
    this._triggerEnd(null)
  }
}
