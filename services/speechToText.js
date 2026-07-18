export default class SpeechToTextService {
  constructor() {
    this.recognition = null
    this.stopped = false
    this._onEnd = null
    this._finalText = ''
  }

  start({ onResult, onError, onEnd, language = 'ar-EG' }) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      onError(new Error('Speech recognition is not supported in this browser'))
      return
    }

    this.stopped = false
    this._onEnd = onEnd
    this._finalText = ''
    this.recognition = new SR()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = language

    let interimText = ''

    this.recognition.onresult = (event) => {
      interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) {
          this._finalText += r[0].transcript + ' '
        } else {
          interimText += r[0].transcript
        }
      }
      onResult({ final: this._finalText.trim(), interim: interimText.trim() })
    }

    this.recognition.onerror = (event) => {
      if (this.stopped) return
      if (event.error === 'no-speech') {
        onError(new Error('لم يتم اكتشاف كلام - No speech detected'))
      } else if (event.error === 'aborted') {
        return
      } else if (event.error === 'language-not-supported') {
        onError(new Error(`اللغة "${language}" غير مدعومة في هذا المتصفح`))
      } else {
        onError(new Error(event.error))
      }
    }

    this.recognition.onend = () => {
      if (this._finalText.trim()) {
        this._onEnd?.(this._finalText.trim())
      } else if (!this.stopped) {
        onError(new Error('لم يتم التعرف على كلام - No speech recognized'))
      }
    }

    this.recognition.start()
  }

  stop() {
    this.stopped = true
    if (this.recognition) {
      try { this.recognition.stop() } catch {}
      this.recognition = null
    }
    if (this._finalText.trim()) {
      this._onEnd?.(this._finalText.trim())
    }
  }
}

