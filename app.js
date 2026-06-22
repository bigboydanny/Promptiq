const ideaInput = document.getElementById('ideaInput')
const draftBtn = document.getElementById('draftBtn')
const thread = document.getElementById('thread')
const manuscript = document.getElementById('manuscript')
const manuscriptText = document.getElementById('manuscriptText')
const composerHint = document.getElementById('composerHint')
const stampSeal = document.getElementById('stampSeal')
const copyBtn = document.getElementById('copyBtn')
const saveBtn = document.getElementById('saveBtn')

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
  manuscriptText.textContent = item.prompt
  manuscript.classList.remove('hidden')
  ideaInput.value = item.idea || ''
  ledgerPanel.classList.remove('open')
  ledgerBackdrop.classList.remove('open')
  ledgerToggle.setAttribute('aria-expanded', 'false')
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
  const numbered = (text.match(/^\s*\d+[\.\)]/gm) || []).length
  return numbered >= 1 && text.trim().endsWith('?')
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
      body: JSON.stringify({ messages: convo })
    })
    const data = await res.json()
    if(!res.ok || data.error){
      addThreadMsg('ai', 'Something broke on the way to the model. Try again in a second.')
      return
    }

    const reply = data.reply.trim()
    convo.push({ role: 'assistant', content: reply })

    if(looksLikeQuestions(reply)){
      addThreadMsg('ai', reply)
      addReplyBox()
    } else {
      finalPrompt = reply
      manuscriptText.textContent = finalPrompt
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
  finalPrompt = ''
  convo = [{ role: 'user', content: idea }]
  stampSeal.textContent = nextStampId()
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
