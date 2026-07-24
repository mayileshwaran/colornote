// ===== ColorNote renderer script (vanilla JS, no frameworks) =====

// ---------- State ----------
let tabs = [];          // { id, title, filePath, content, isDirty }
let activeTabId = null;
let tabCounter = 0;
let lastFindIndex = -1; // for Find Next

// ---------- Element refs ----------
const editor = document.getElementById('editor');
const tabsBar = document.getElementById('tabsBar');
const btnNewTab = document.getElementById('btnNewTab');

const btnNew = document.getElementById('btnNew');
const btnOpen = document.getElementById('btnOpen');
const btnSave = document.getElementById('btnSave');
const btnSaveAs = document.getElementById('btnSaveAs');

const btnBold = document.getElementById('btnBold');
const btnItalic = document.getElementById('btnItalic');
const btnUnderline = document.getElementById('btnUnderline');

const fontFamilySel = document.getElementById('fontFamily');
const fontSizeSel = document.getElementById('fontSize');
const textColorInput = document.getElementById('textColor');
const bgColorInput = document.getElementById('bgColor');

const btnWordWrap = document.getElementById('btnWordWrap');
const btnTheme = document.getElementById('btnTheme');

const findReplacePanel = document.getElementById('findReplacePanel');
const findInput = document.getElementById('findInput');
const replaceInput = document.getElementById('replaceInput');
const btnFindNext = document.getElementById('btnFindNext');
const btnReplaceOne = document.getElementById('btnReplaceOne');
const btnReplaceAll = document.getElementById('btnReplaceAll');
const btnCloseFind = document.getElementById('btnCloseFind');
const findStatus = document.getElementById('findStatus');

const statusWords = document.getElementById('statusWords');
const statusChars = document.getElementById('statusChars');
const statusLines = document.getElementById('statusLines');
const statusCursor = document.getElementById('statusCursor');
const statusPath = document.getElementById('statusPath');

// ---------- Populate font size options ----------
[8,9,10,11,12,14,16,18,20,24,28,32,36,48].forEach(sz => {
  const opt = document.createElement('option');
  opt.value = sz;
  opt.textContent = sz;
  if (sz === 15 || sz === 16) opt.selected = true;
  fontSizeSel.appendChild(opt);
});

// ================= Tabs =================
function genId() { return 'tab-' + (++tabCounter) + '-' + Date.now(); }

function basename(p) {
  if (!p) return '';
  return p.split(/[\\/]/).pop();
}

function createTab(content = '', filePath = null, title = null) {
  const tab = {
    id: genId(),
    title: title || (filePath ? basename(filePath) : 'Untitled'),
    filePath: filePath,
    content: content,
    isDirty: false
  };
  tabs.push(tab);
  activateTab(tab.id);
  renderTabs();
  return tab;
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

// Save current textarea state back into its tab record
function syncActiveTabFromEditor() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
}

function activateTab(id) {
  syncActiveTabFromEditor();
  activeTabId = id;
  const tab = getActiveTab();
  if (tab) {
    editor.value = tab.content;
    statusPath.textContent = tab.filePath || 'Not saved yet';
  }
  updateStatusBar();
  renderTabs();
  editor.focus();
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  const tab = tabs[idx];
  if (tab.isDirty) {
    const ok = confirm(`"${tab.title}" has unsaved changes. Close anyway?`);
    if (!ok) return;
  }

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    createTab(); // always keep at least one tab open
    return;
  }

  if (activeTabId === id) {
    const next = tabs[idx] || tabs[idx - 1] || tabs[0];
    activateTab(next.id);
  } else {
    renderTabs();
  }
}

function markDirty() {
  const tab = getActiveTab();
  if (tab && !tab.isDirty) {
    tab.isDirty = true;
    renderTabs();
  }
}

function renderTabs() {
  tabsBar.querySelectorAll('.tab').forEach(el => el.remove());

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.dataset.id = tab.id;

    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = (tab.isDirty ? '● ' : '') + tab.title;

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '✕';
    close.title = 'Close tab';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    el.appendChild(name);
    el.appendChild(close);
    el.addEventListener('click', () => activateTab(tab.id));

    tabsBar.insertBefore(el, btnNewTab);
  });
}

// ================= File operations =================
async function newDocument() {
  createTab();
}

async function openFile() {
  const result = await window.electronAPI.openFile();
  if (!result || result.canceled) return;
  createTab(result.content, result.filePath);
}

async function saveFile() {
  const tab = getActiveTab();
  if (!tab) return;
  syncActiveTabFromEditor();

  if (tab.filePath) {
    const result = await window.electronAPI.saveFile(tab.filePath, tab.content);
    if (result && result.success) {
      tab.isDirty = false;
      renderTabs();
    }
  } else {
    await saveFileAs();
  }
}

async function saveFileAs() {
  const tab = getActiveTab();
  if (!tab) return;
  syncActiveTabFromEditor();

  const result = await window.electronAPI.saveFileAs(tab.content, tab.title.endsWith('.txt') ? tab.title : tab.title + '.txt');
  if (result && !result.canceled) {
    tab.filePath = result.filePath;
    tab.title = basename(result.filePath);
    tab.isDirty = false;
    statusPath.textContent = tab.filePath;
    renderTabs();
  }
}

// ================= Formatting (Bold / Italic / Underline) =================
// Applied as a visual style toggle on the whole editor surface,
// since plain .txt files cannot store per-character rich formatting.
function toggleFormat(type, btn) {
  editor.classList.toggle(type);
  btn.classList.toggle('active');
}

// ================= Font / Color settings =================
function applyFont() {
  editor.style.fontFamily = fontFamilySel.value;
  localStorage.setItem('colornote_font', fontFamilySel.value);
}

function applyFontSize() {
  editor.style.fontSize = fontSizeSel.value + 'px';
  localStorage.setItem('colornote_fontsize', fontSizeSel.value);
}

function applyTextColor() {
  editor.style.color = textColorInput.value;
  localStorage.setItem('colornote_textcolor', textColorInput.value);
}

function applyBgColor() {
  editor.style.backgroundColor = bgColorInput.value;
  localStorage.setItem('colornote_bgcolor', bgColorInput.value);
}

// ================= Word wrap =================
function applyWordWrap(enabled) {
  editor.classList.toggle('nowrap', !enabled);
  btnWordWrap.classList.toggle('active', !enabled);
  localStorage.setItem('colornote_wordwrap', enabled ? '1' : '0');
}

function toggleWordWrap() {
  const currentlyWrapped = !editor.classList.contains('nowrap');
  applyWordWrap(!currentlyWrapped);
}

// ================= Theme =================
function applyTheme(dark) {
  document.body.classList.toggle('dark-theme', dark);
  localStorage.setItem('colornote_theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  applyTheme(!document.body.classList.contains('dark-theme'));
}

// ================= Load saved settings =================
function loadSettings() {
  const font = localStorage.getItem('colornote_font');
  if (font) { fontFamilySel.value = font; }
  applyFont();

  const size = localStorage.getItem('colornote_fontsize');
  if (size) { fontSizeSel.value = size; }
  applyFontSize();

  const textColor = localStorage.getItem('colornote_textcolor');
  if (textColor) { textColorInput.value = textColor; }
  applyTextColor();

  const bgColor = localStorage.getItem('colornote_bgcolor');
  if (bgColor) { bgColorInput.value = bgColor; }
  applyBgColor();

  const wordWrap = localStorage.getItem('colornote_wordwrap');
  applyWordWrap(wordWrap === null ? true : wordWrap === '1');

  const theme = localStorage.getItem('colornote_theme');
  applyTheme(theme === 'dark');
}

// ================= Status bar =================
function updateStatusBar() {
  const text = editor.value;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;
  const lines = text.split('\n').length;

  const pos = editor.selectionStart;
  const before = text.substring(0, pos);
  const lineNum = before.split('\n').length;
  const colNum = before.length - before.lastIndexOf('\n');

  statusWords.textContent = `Words: ${words}`;
  statusChars.textContent = `Characters: ${chars}`;
  statusLines.textContent = `Lines: ${lines}`;
  statusCursor.textContent = `Ln ${lineNum}, Col ${colNum}`;
}

// ================= Find & Replace =================
function openFindReplace(withReplace) {
  findReplacePanel.classList.remove('hidden');
  replaceInput.style.display = withReplace ? 'inline-block' : 'inline-block';
  findInput.focus();
  findInput.select();
}

function closeFindReplace() {
  findReplacePanel.classList.add('hidden');
  editor.focus();
}

function findNext() {
  const query = findInput.value;
  if (!query) return;
  const text = editor.value;

  let startFrom = editor.selectionEnd || 0;
  let idx = text.indexOf(query, startFrom);

  if (idx === -1) {
    // wrap around to start
    idx = text.indexOf(query, 0);
  }

  if (idx === -1) {
    findStatus.textContent = 'Not found';
    return;
  }

  editor.focus();
  editor.setSelectionRange(idx, idx + query.length);
  lastFindIndex = idx;
  findStatus.textContent = '';
  updateStatusBar();
}

function replaceOne() {
  const query = findInput.value;
  if (!query) return;

  const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
  if (selected === query) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(replaceInput.value, start, end, 'end');
    markDirty();
  }
  findNext();
}

function replaceAll() {
  const query = findInput.value;
  if (!query) return;
  const replacement = replaceInput.value;
  const text = editor.value;
  const parts = text.split(query);
  const count = parts.length - 1;
  editor.value = parts.join(replacement);
  findStatus.textContent = `Replaced ${count}`;
  markDirty();
  updateStatusBar();
}

// ================= Menu dropdown handling =================
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
    e.stopPropagation();
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
});

document.querySelectorAll('.dropdown button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    runAction(btn.dataset.action);
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
  });
});

function runAction(action) {
  switch (action) {
    case 'new': newDocument(); break;
    case 'open': openFile(); break;
    case 'save': saveFile(); break;
    case 'saveas': saveFileAs(); break;
    case 'undo': document.execCommand('undo'); break;
    case 'redo': document.execCommand('redo'); break;
    case 'cut': document.execCommand('cut'); break;
    case 'copy': document.execCommand('copy'); break;
    case 'paste': document.execCommand('paste'); break;
    case 'selectall': editor.focus(); editor.select(); break;
    case 'find': openFindReplace(false); break;
    case 'replace': openFindReplace(true); break;
    case 'bold': toggleFormat('bold', btnBold); break;
    case 'italic': toggleFormat('italic', btnItalic); break;
    case 'underline': toggleFormat('underline', btnUnderline); break;
    case 'wordwrap': toggleWordWrap(); break;
    case 'theme': toggleTheme(); break;
    case 'about': alert('ColorNote 1.0\nA simple, colorful text editor built with Electron.'); break;
  }
}

// ================= Toolbar events =================
btnNew.addEventListener('click', newDocument);
btnOpen.addEventListener('click', openFile);
btnSave.addEventListener('click', saveFile);
btnSaveAs.addEventListener('click', saveFileAs);

btnBold.addEventListener('click', () => toggleFormat('bold', btnBold));
btnItalic.addEventListener('click', () => toggleFormat('italic', btnItalic));
btnUnderline.addEventListener('click', () => toggleFormat('underline', btnUnderline));

fontFamilySel.addEventListener('change', applyFont);
fontSizeSel.addEventListener('change', applyFontSize);
textColorInput.addEventListener('input', applyTextColor);
bgColorInput.addEventListener('input', applyBgColor);

btnWordWrap.addEventListener('click', toggleWordWrap);
btnTheme.addEventListener('click', toggleTheme);

btnNewTab.addEventListener('click', newDocument);

btnFindNext.addEventListener('click', findNext);
btnReplaceOne.addEventListener('click', replaceOne);
btnReplaceAll.addEventListener('click', replaceAll);
btnCloseFind.addEventListener('click', closeFindReplace);
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') findNext();
  if (e.key === 'Escape') closeFindReplace();
});

// ================= Editor events =================
editor.addEventListener('input', () => {
  markDirty();
  updateStatusBar();
});
editor.addEventListener('keyup', updateStatusBar);
editor.addEventListener('click', updateStatusBar);

// ================= Keyboard shortcuts =================
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  const key = e.key.toLowerCase();

  if (key === 'n') { e.preventDefault(); newDocument(); }
  else if (key === 'o') { e.preventDefault(); openFile(); }
  else if (key === 's' && e.shiftKey) { e.preventDefault(); saveFileAs(); }
  else if (key === 's') { e.preventDefault(); saveFile(); }
  else if (key === 'f') { e.preventDefault(); openFindReplace(false); }
  else if (key === 'h') { e.preventDefault(); openFindReplace(true); }
  else if (key === 'b') { e.preventDefault(); toggleFormat('bold', btnBold); }
  else if (key === 'i') { e.preventDefault(); toggleFormat('italic', btnItalic); }
  else if (key === 'u') { e.preventDefault(); toggleFormat('underline', btnUnderline); }
  // Ctrl+Z / Ctrl+Y (undo/redo) and Ctrl+X/C/V/A (cut/copy/paste/select all)
  // are left to the browser/textarea's native, built-in behavior.
});

// Prevent the panel's find/replace shortcuts from also triggering while typing there
findReplacePanel.addEventListener('keydown', (e) => e.stopPropagation());

// ================= Init =================
loadSettings();
createTab();
updateStatusBar();
