const ideaInput = document.getElementById('ideaInput')
const draftBtn = document.getElementById('draftBtn')
const thread = document.getElementById('thread')
const manuscript = document.getElementById('manuscript')
const manuscriptText = document.getElementById('manuscriptText')
const composerHint = document.getElementById('composerHint')
const composerLabel = document.getElementById('composerLabel')
const stampSeal = document.getElementById('stampSeal')
const copyBtn = document.getElementById('copyBtn')
const saveBtn = document.getElementById('saveBtn')
const modeToggle = document.getElementById('modeToggle')
const emptyState = document.getElementById('emptyState')
const starterList = document.getElementById('starterList')

const STARTERS = [
  { label: 'Refactor a messy function', idea: 'A prompt that gets an AI to refactor a messy JavaScript function for readability without changing its behavior' },
  { label: 'Strict code reviewer', idea: 'A prompt that makes an AI review my pull requests like a senior engineer who catches everything', mode: 'persona' },
  { label: 'Debug a stack trace', idea: 'A prompt that gets an AI to diagnose a Python stack trace and explain the root cause before suggesting a fix' },
  { label: 'Write unit tests', idea: 'A prompt that gets an AI to write thorough unit tests for a function, covering edge cases I might not think of' }
]

function renderStarters(){
  starterList.innerHTML = ''
  STARTERS.forEach(s => {
    const btn = document.createElement('button')
    btn.className = 'starter-chip'
    btn.textContent = s.label
    btn.addEventListener('click', () => {
      ideaInput.value = s.idea
      if(s.mode && s.mode !== mode){
        const modeBtn = modeToggle.querySelector(`[data-mode="${s.mode}"]`)
        if(modeBtn) modeBtn.click()
      }
      ideaInput.focus()
    })
    starterList.appendChild(btn)
  })
}
renderStarters()

let mode = 'general'

const MODE_COPY = {
  general: {
    label: 'What are you trying to get an AI to do?',
    placeholder: "e.g. I need a prompt that gets an AI to write cold emails for my landscaping business that don't sound like cold emails"
  },
  persona: {
    label: 'What should the bot be?',
    placeholder: 'e.g. a blunt senior code reviewer who never sugarcoats feedback and always asks for tests'
  }
}

modeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn')
  if(!btn) return
  mode = btn.dataset.mode
  modeToggle.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn))
  composerLabel.textContent = MODE_COPY[mode].label
  ideaInput.placeholder = MODE_COPY[mode].placeholder
})

const ledgerToggle = document.getElementById('ledgerToggle')
const ledgerPanel = document.getElementById('ledger')
const ledgerList = document.getElementById('ledgerList')
const ledgerCount = document.getElementById('ledgerCount')

const renameOverlay = document.getElementById('renameOverlay')
const renameInput = document.getElementById('renameInput')
const renameConfirm = document.getElementById('renameConfirm')
const renameCancel = document.getElementById('renameCancel')

const STORE_KEY = 'pq.ledger.v1'
let convo = []
let finalPrompt = ''
let busy = false

function nextStampId(){
  const ledger = readLedger()
  const n = ledger.length + 1
  return `PQ-${String(n).padStart(4, '0')}`
}

function readLedger(){
  try{
    return JSON.parse(localStorage.getItem(STORE_KEY)) || []
  }catch(e){
    return []
  }
}

function writeLedger(items){
  localStorage.setItem(STORE_KEY, JSON.stringify(items))
}

function renderLedger(){
  const items = readLedger()
  ledgerCount.textContent = items.length
  if(!items.length){
    ledgerList.innerHTML = '<p class="ledger-empty">Nothing filed yet. Draft something and stamp it.</p>'
    return
  }
  ledgerList.innerHTML = ''
  items.slice().reverse().forEach(item => {
    const row = document.createElement('div')
    row.className = 'ledger-item'
    row.innerHTML = `
      <div class="ledger-item-name">${escapeHtml(item.name)}</div>
      <div class="ledger-item-id">${item.id}</div>
      <button class="ledger-item-del" title="Remove">&times;</button>
    `
    row.addEventListener('click', (e) => {
      if(e.target.classList.contains('ledger-item-del')) return
      loadFromLedger(item)
    })
    row.querySelector('.ledger-item-del').addEventListener('click', (e) => {
      e.stopPropagation()
      const filtered = readLedger().filter(x => x.id !== item.id)
      writeLedger(filtered)
      renderLedger()
    })
    ledgerList.appendChild(row)
  })
}

function loadFromLedger(item){
  thread.innerHTML = ''
  convo = []
  finalPrompt = item.prompt
  manuscriptText.innerHTML = renderMd(item.prompt)
  manuscript.classList.remove('hidden')
  emptyState.classList.add('hidden')
  ideaInput.value = item.idea || ''
  if(item.mode && item.mode !== mode){
    const btn = modeToggle.querySelector(`[data-mode="${item.mode}"]`)
    if(btn) btn.click()
  }
  ledgerPanel.classList.remove('open')
  ledgerBackdrop.classList.remove('open')
  ledgerToggle.setAttribute('aria-expanded', 'false')
}

function renderMd(raw) {
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) =>
    `<pre><code>${c.trimEnd()}</code></pre>`)

  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  s = s.replace(/^---$/gm, '<hr>')
  s = s.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  s = s.replace(/((?:^[-*] .+\n?)+)/gm, blk =>
    '<ul>' + blk.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('') + '</ul>')

  s = s.replace(/((?:^\d+\. .+\n?)+)/gm, blk =>
    '<ol>' + blk.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('') + '</ol>')

  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/_(.+?)_/g, '<em>$1</em>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')

  s = s.replace(/^(?!<[houbl]|<hr|<blockquote|<pre)(.+)$/gm, '<p>$1</p>')

  return s
}

function escapeHtml(str){
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

const ledgerBackdrop = document.getElementById('ledgerBackdrop')

ledgerToggle.addEventListener('click', () => {
  const open = ledgerPanel.classList.toggle('open')
  ledgerBackdrop.classList.toggle('open', open)
  ledgerToggle.setAttribute('aria-expanded', String(open))
})

ledgerBackdrop.addEventListener('click', () => {
  ledgerPanel.classList.remove('open')
  ledgerBackdrop.classList.remove('open')
  ledgerToggle.setAttribute('aria-expanded', 'false')
})

function addThreadMsg(role, text){
  const wrap = document.createElement('div')
  wrap.className = `thread-msg ${role}`
  const tag = document.createElement('span')
  tag.className = 'thread-tag'
  tag.textContent = role === 'ai' ? 'PQ' : 'YOU'
  const body = document.createElement('span')
  body.className = 'thread-body'
  body.textContent = text
  wrap.appendChild(tag)
  wrap.appendChild(body)
  thread.appendChild(wrap)
  wrap.scrollIntoView({ behavior: 'smooth', block: 'end' })
  return wrap
}

function addReplyBox(){
  const old = thread.querySelector('.thread-reply')
  if(old) old.remove()
  const wrap = document.createElement('div')
  wrap.className = 'thread-reply'
  wrap.innerHTML = `<input type="text" placeholder="Answer here..."><button class="primary-btn">Send</button>`
  const input = wrap.querySelector('input')
  const btn = wrap.querySelector('button')
  const send = () => {
    const val = input.value.trim()
    if(!val) return
    wrap.remove()
    addThreadMsg('user', val)
    convo.push({ role: 'user', content: val })
    runDraft()
  }
  btn.addEventListener('click', send)
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') send() })
  thread.appendChild(wrap)
  input.focus()
}

function looksLikeQuestions(text){
  const trimmed = text.trim()
  if(!trimmed.endsWith('?')) return false
  const wordCount = trimmed.split(/\s+/).length
  return wordCount < 80
}

async function runDraft(){
  if(busy) return
  busy = true
  draftBtn.disabled = true
  composerHint.textContent = 'thinking...'

  try{
    const res = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: convo, mode })
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      addThreadMsg('ai', `Something broke on the way to the model: ${data.detail || data.error || res.status}`)
      return
    }

    const reply = data.reply.trim()
    convo.push({ role: 'assistant', content: reply })

    if(looksLikeQuestions(reply)){
      addThreadMsg('ai', reply)
      addReplyBox()
    } else {
      finalPrompt = reply
      manuscriptText.innerHTML = renderMd(finalPrompt)
      manuscript.classList.remove('hidden')
      manuscript.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }catch(e){
    addThreadMsg('ai', 'Lost connection to the desk. Check your network and try again.')
  }finally{
    busy = false
    draftBtn.disabled = false
    composerHint.textContent = ''
  }
}

draftBtn.addEventListener('click', () => {
  const idea = ideaInput.value.trim()
  if(!idea) return
  thread.innerHTML = ''
  manuscript.classList.add('hidden')
  emptyState.classList.add('hidden')
  finalPrompt = ''
  convo = [{ role: 'user', content: idea }]
  stampSeal.textContent = nextStampId()
  stampSeal.classList.remove('stamping')
  requestAnimationFrame(() => stampSeal.classList.add('stamping'))
  runDraft()
})

ideaInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){
    draftBtn.click()
  }
})

copyBtn.addEventListener('click', async () => {
  if(!finalPrompt) return
  await navigator.clipboard.writeText(finalPrompt)
  const original = copyBtn.textContent
  copyBtn.textContent = 'Copied'
  setTimeout(() => copyBtn.textContent = original, 1400)
})

saveBtn.addEventListener('click', () => {
  if(!finalPrompt) return
  renameInput.value = ideaInput.value.slice(0, 48) || 'Untitled prompt'
  renameOverlay.classList.remove('hidden')
  renameInput.focus()
  renameInput.select()
})

renameCancel.addEventListener('click', () => renameOverlay.classList.add('hidden'))
renameOverlay.addEventListener('click', (e) => {
  if(e.target === renameOverlay) renameOverlay.classList.add('hidden')
})

renameConfirm.addEventListener('click', () => {
  const name = renameInput.value.trim() || 'Untitled prompt'
  const items = readLedger()
  items.push({
    id: nextStampId(),
    name,
    prompt: finalPrompt,
    idea: ideaInput.value,
    mode,
    createdAt: Date.now()
  })
  writeLedger(items)
  renderLedger()
  renameOverlay.classList.add('hidden')
})

renameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') renameConfirm.click()
})

renderLedger()
