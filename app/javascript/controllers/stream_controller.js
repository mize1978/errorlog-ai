import { Controller } from "@hotwired/stimulus"

const BOOT = [
  { type: "line", cls: "ok",   text: "✓ Booting DebugMe v1.0.0...",                          delay: 0    },
  { type: "line", cls: "info", text: "  Connecting to Claude API...",                         delay: 420  },
  { type: "line", cls: "ok",   text: "✓ Connection established ⚡",                           delay: 820  },
  { type: "line", cls: "info", text: "  Initializing AI engine (claude-sonnet-4-6)...",       delay: 1100 },
  { type: "prog", label: "Analyzing input data...   ",                                         delay: 1380 },
  { type: "line", cls: "ok",   text: "✓ Input processed",                                     delay: 1700 },
  { type: "prog", label: "Building diagnostic context...",                                      delay: 1950 },
  { type: "prog", label: "Generating error log...  ",                                           delay: 2350 },
  { type: "line", cls: "warn", text: "  Compiling stack trace...",                             delay: 2700 },
  { type: "line", cls: "ok",   text: "✓ Stream ready ⚡",                                     delay: 2900 },
]
const BOOT_DONE = 3200

const QUOTES = [
  "バグは仕様だ — Anonymous Engineer",
  "エラーは成長への招待状 — Claude AI",
  "人生はデバッグの繰り返し — 不明",
  "コードも心も、リファクタリングで輝く — 誰か",
  "404: 完璧な人間は見つかりません — System",
]

export default class extends Controller {
  static targets = [
    "catAvatar", "catBubble",
    "bootSequence", "consoleBody",
    "gaugeFill", "gaugePct", "gaugeRisk",
    "selfEsteemFill", "selfEsteemVal",
    "actionFill", "actionVal",
    "communicationFill", "communicationVal",
    "logicFill", "logicVal",
    "fixList", "fixProgressWrap", "fixProgressFill", "fixProgressPct",
    "shareX", "shareCopy",
    "quoteText",
  ]
  static values = { url: String }

  connect() {
    this.bootDone    = false
    this.pendingData = null
    this.shareUrl    = window.location.href

    this.setQuote()

    if (this.hasUrlValue && this.urlValue) {
      this.runBoot()
      this.openSSE()
    }
  }

  disconnect() {
    if (this.es) this.es.close()
  }

  // ── Quote ──
  setQuote() {
    if (!this.hasQuoteTextTarget) return
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)]
    this.quoteTextTarget.textContent = q
  }

  // ── Boot sequence ──
  runBoot() {
    this.setCat("analyzing", "", "...")
    BOOT.forEach(step => setTimeout(() => this.renderStep(step), step.delay))
    setTimeout(() => {
      this.bootDone = true
      if (this.pendingData) this.renderComplete(this.pendingData)
    }, BOOT_DONE)
  }

  renderStep(step) {
    const ts = this.ts()
    if (step.type === "line") {
      const el = document.createElement("div")
      el.className = "console-line"
      el.innerHTML = `<span class="console-ts">[${ts}]</span><span class="console-txt ${step.cls}">${this.esc(step.text)}</span>`
      this.bootSequenceTarget.appendChild(el)
      return
    }
    if (step.type === "prog") {
      const el = document.createElement("div")
      el.className = "console-progress"
      el.innerHTML = `
        <span class="progress-label">${this.esc(step.label)}</span>
        <div class="progress-track"><div class="progress-fill"></div></div>
        <span class="progress-pct">0%</span>
      `
      this.bootSequenceTarget.appendChild(el)
      requestAnimationFrame(() => {
        el.querySelector(".progress-fill").style.width = "100%"
        el.querySelector(".progress-pct").textContent  = "100%"
      })
    }
  }

  // ── SSE ──
  openSSE() {
    this.es = new EventSource(this.urlValue)
    this.es.addEventListener("complete", e => {
      this.es.close()
      const data = JSON.parse(e.data)
      if (this.bootDone) {
        this.renderComplete(data)
      } else {
        this.pendingData = data
      }
    })
    this.es.addEventListener("error", () => {
      this.es.close()
      this.addLine("ERROR: AI connection failed", "err")
    })
  }

  // ── Render result ──
  async renderComplete(data) {
    try {
    await this.wait(200)
    this.addLine("⚠️  ERROR DETECTED — ログ生成完了", "err")
    await this.wait(350)
    this.setCat("alert", "alert", "ログを整理しています...")

    await this.wait(400)
    const divider = document.createElement("div")
    divider.className = "error-log-divider"
    divider.innerHTML = `
      <div class="divider-line"></div>
      <span class="divider-label">▼ ERROR LOG GENERATED</span>
      <div class="divider-line"></div>
    `
    this.bootSequenceTarget.after(divider)

    const box = document.createElement("div")
    box.className = "error-log-box"
    divider.after(box)

    await this.wait(300)
    await this.typewrite(data.error_log || "", box)

    if (data.caused_by || data.hint || data.log_time) {
      const meta = document.createElement("div")
      meta.className = "error-log-meta"
      meta.innerHTML = [
        data.caused_by ? `<span class="meta-key">Caused by:</span> <span class="meta-val">${this.esc(data.caused_by)}</span>` : "",
        data.hint      ? `<span class="meta-key">Hint:</span>      <span class="meta-hint">${this.esc(data.hint)}</span>` : "",
        data.log_time  ? `<span class="meta-key">Time:</span>      <span class="meta-dim">${this.esc(data.log_time)}</span>` : "",
        data.log_id    ? `<span class="meta-key">ID:</span>        <span class="meta-dim">${this.esc(data.log_id)}</span>` : "",
      ].filter(Boolean).join("\n")
      box.appendChild(meta)
    }

    // デカ目ピクセル猫をエラーログの右側に出す
    const pixelCat = document.createElement("img")
    pixelCat.src = "/images/cat-pixel.png"
    pixelCat.className = "error-pixel-cat"
    pixelCat.alt = "NECO"
    box.appendChild(pixelCat)
    setTimeout(() => pixelCat.classList.add("visible"), 150)

    await this.wait(500)
    this.setCat("fix", "fix", "ログが完成しました。")
    this.animateGauges(data.summary || {})

    await this.wait(600)
    this.renderFixes(data.suggested_fix || [])
    this.updateShare(data)
    } catch(e) { console.error("renderComplete error:", e) }
  }

  // ── Gauges ──
  animateGauges(s) {
    const sev = s.severity || 0
    const offset = 314.16 * (1 - sev / 100)
    this.gaugeFillTarget.style.strokeDashoffset = offset
    this.gaugePctTarget.textContent = `${sev}%`

    let riskCls, riskLabel
    if (sev >= 70)      { riskCls = "high"; riskLabel = "HIGH RISK" }
    else if (sev >= 40) { riskCls = "mid";  riskLabel = "MODERATE"  }
    else                { riskCls = "low";  riskLabel = "LOW RISK"  }

    this.gaugeFillTarget.setAttribute("class", `gauge-fill ${riskCls}`)
    this.gaugeRiskTarget.setAttribute("class", `gauge-risk ${riskCls}`)
    this.gaugeRiskTarget.textContent = riskLabel

    this.setBar("selfEsteem",    "SelfEsteem",    s.self_esteem   || 0)
    this.setBar("action",        "Action",        s.action        || 0)
    this.setBar("communication", "Communication", s.communication || 0)
    this.setBar("logic",         "Logic",         s.logic         || 0)
  }

  setBar(key, capitalized, val) {
    const fillProp = `has${capitalized}FillTarget`
    const valProp  = `has${capitalized}ValTarget`
    if (this[fillProp]) this[`${key}FillTarget`].style.width = `${val}%`
    if (this[valProp])  this[`${key}ValTarget`].textContent  = `${val}%`
  }

  // ── Fixes ──
  renderFixes(fixes) {
    this.fixListTarget.innerHTML = ""
    fixes.forEach((fix, i) => {
      const li = document.createElement("li")
      li.className = "fix-item"
      li.innerHTML = `<span class="fix-check">✓</span><span>${this.esc(fix)}</span>`
      this.fixListTarget.appendChild(li)
      setTimeout(() => li.classList.add("visible"), i * 280)
    })
    if (fixes.length > 0 && this.hasFixProgressWrapTarget) {
      this.fixProgressWrapTarget.style.display = "block"
      const pct = Math.min(30 + fixes.length * 20, 90)
      setTimeout(() => {
        this.fixProgressFillTarget.style.width = `${pct}%`
        this.fixProgressPctTarget.textContent   = `${pct}%`
      }, 100)
    }
  }

  // ── Share ──
  updateShare(data) {
    if (!this.hasShareXTarget) return
    const firstLine = (data.error_log || "").split("\n")[0] || ""
    const sev  = (data.summary || {}).severity || 0
    const text = encodeURIComponent(`悩みをAIがデバッグしてくれた！\n深刻度: ${sev}%\n${firstLine}\n\nDebug your day. #DebugMe`)
    const url  = encodeURIComponent(this.shareUrl)
    this.shareXTarget.href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`
  }

  copy() {
    if (!this.hasConsoleBodyTarget) return
    const box = this.consoleBodyTarget.querySelector(".error-log-box")
    if (box) navigator.clipboard.writeText(box.textContent)
  }

  // ── Helpers ──
  setCat(state, mood, text) {
    if (this.hasCatAvatarTarget) {
      const el = this.catAvatarTarget
      el.className = `cat-img ${state}`
    }
    if (this.hasCatBubbleTarget) {
      this.catBubbleTarget.className   = `cat-bubble ${mood}`
      this.catBubbleTarget.textContent = text
    }
  }

  addLine(text, cls = "") {
    const el = document.createElement("div")
    el.className = "console-line"
    el.innerHTML = `<span class="console-ts">[${this.ts()}]</span><span class="console-txt ${cls}">${this.esc(text)}</span>`
    this.bootSequenceTarget.appendChild(el)
    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  async typewrite(text, el) {
    for (let i = 0; i < text.length; i += 4) {
      el.textContent += text.slice(i, i + 4)
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      await this.wait(12)
    }
  }

  wait(ms) { return new Promise(r => setTimeout(r, ms)) }

  ts() {
    const d = new Date()
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2, "0")).join(":")
  }

  esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }
}
