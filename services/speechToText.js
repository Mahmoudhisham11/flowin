export default class SpeechToTextService {
  constructor() {
    this.recognition = null
    this.stopped = false
    this._onEnd = null
    this._ended = false
    this._finalText = ''
    this._language = 'ar-EG'
    this._accumulated = ''
  }

  start({ onResult, onError, onEnd, language = 'ar-EG' }) {
    const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
    if (!SR) {
      onError?.(new Error('Speech recognition is not supported in this browser'))
      return
    }

    this.stopped = false
    this._ended = false
    this._onEnd = onEnd
    this._finalText = ''
    this._accumulated = ''
    this._language = language

    try {
      this.recognition = new SR()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = language
    } catch (err) {
      onError?.(err)
      return
    }

    this.recognition.onresult = (event) => {
      let currentFinal = ''
      let currentInterim = ''

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i]
        const text = item[0]?.transcript || ''
        if (item.isFinal) {
          currentFinal += text + ' '
        } else {
          currentInterim += text
        }
      }

      if (currentFinal) {
        this._finalText = (this._accumulated + ' ' + currentFinal).trim()
      } else {
        this._finalText = (this._accumulated + ' ' + currentInterim).trim()
      }

      onResult?.({
        final: this._finalText,
        interim: currentInterim.trim(),
      })
    }

    this.recognition.onerror = (event) => {
      if (this.stopped) return

      // Silence or no speech detected: do NOT abort or stop recording
      if (event.error === 'no-speech') {
        return
      }

      if (event.error === 'aborted') {
        return
      }

      if (event.error === 'not-allowed') {
        this.stopped = true
        onError?.(new Error('تم رفض إذن الميكروفون - Microphone access denied'))
      } else if (event.error === 'language-not-supported') {
        this.stopped = true
        onError?.(new Error(`اللغة "${language}" غير مدعومة في هذا المتصفح`))
      }
    }

    this.recognition.onend = () => {
      // If user did NOT manually stop, keep recognition alive and continuously listening
      if (!this.stopped) {
        if (this._finalText) {
          this._accumulated = this._finalText
        }
        try {
          this.recognition?.start()
        } catch {
          setTimeout(() => {
            if (!this.stopped) {
              try {
                this.recognition?.start()
              } catch {}
            }
          }, 150)
        }
        return
      }

      this._triggerEnd(onError)
    }

    try {
      this.recognition.start()
    } catch (err) {
      onError?.(err)
    }
  }

  _triggerEnd(onError) {
    if (this._ended) return
    this._ended = true

    const text = this._finalText.trim()
    if (text) {
      this._onEnd?.(text)
    } else if (!this.stopped && onError) {
      onError?.(new Error('لم يتم التعرف على كلام - No speech recognized'))
    }
  }

  stop() {
    this.stopped = true
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {}
    }
    this._triggerEnd(null)
  }
}
