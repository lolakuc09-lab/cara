// ================= CONFIG =================
const API_URL = "https://carab.fedegromero.workers.dev";

// ================= USER ID =================
const USER_ID = localStorage.getItem("cara_user_id") || (() => {
  const id = "user_" + Math.random().toString(36).slice(2);
  localStorage.setItem("cara_user_id", id);
  return id;
})();

// ================= ELEMENTOS =================
const start = document.getElementById("start");
const startBtn = document.getElementById("startBtn");

const v1 = document.getElementById("v1");
const v2 = document.getElementById("v2");
let front = v1, back = v2;

const msg = document.getElementById("msg");
const send = document.getElementById("send");

const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const menuBackdrop = document.getElementById("menuBackdrop");

const voiceRate = document.getElementById("voiceRate");
const voiceRateVal = document.getElementById("voiceRateVal");
const intensity = document.getElementById("intensity");
const intensityVal = document.getElementById("intensityVal");
const zoom = document.getElementById("zoom");
const zoomVal = document.getElementById("zoomVal");

const modeNormal = document.getElementById("modeNormal");
const modeAdult = document.getElementById("modeAdult");
const autoToggle = document.getElementById("autoToggle");
const forceNext = document.getElementById("forceNext");

const statusText = document.getElementById("statusText");

// ================= ESTADO =================
let audioUnlocked = false;

let brain = {
  mood: "soft",
  lastUser: Date.now(),
  lastAuto: 0
};

// settings persistentes
const LS_KEY = "cara_settings_v3";
let adultMode = false;
let autoMode = true;

function loadSettings(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    if (typeof s.adultMode === "boolean") adultMode = s.adultMode;
    if (typeof s.autoMode === "boolean") autoMode = s.autoMode;
    if (typeof s.voiceRate === "number") voiceRate.value = String(s.voiceRate);
    if (typeof s.intensity === "number") intensity.value = String(s.intensity);
    if (typeof s.zoom === "number") zoom.value = String(s.zoom);
  } catch {}
}

function saveSettings(){
  localStorage.setItem(LS_KEY, JSON.stringify({
    adultMode,
    autoMode,
    voiceRate: parseFloat(voiceRate.value),
    intensity: parseFloat(intensity.value),
    zoom: parseFloat(zoom.value)
  }));
}

// ================= MENU =================
function isMenuOpen(){ return sideMenu.classList.contains("open"); }
function openMenu(){
  sideMenu.classList.add("open");
  menuBackdrop.classList.add("open");
  menuBtn.setAttribute("aria-expanded","true");
  sideMenu.setAttribute("aria-hidden","false");
}
function closeMenu(){
  sideMenu.classList.remove("open");
  menuBackdrop.classList.remove("open");
  menuBtn.setAttribute("aria-expanded","false");
  sideMenu.setAttribute("aria-hidden","true");
}
function toggleMenu(){ isMenuOpen() ? closeMenu() : openMenu(); }

menuBtn.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); toggleMenu(); });
menuBackdrop.addEventListener("click", closeMenu);
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && isMenuOpen()) closeMenu(); });
sideMenu.addEventListener("click",(e)=>e.stopPropagation());

// ================= VIDEO =================
const videoPools = {
  idle:[1,2,3,4],
  soft:[5,6,7,8],
  tease:[9,10,11,12],
  hot:[13,14],
  intense:[15,16,17,18,19,20,21,22,23,24]
};

function pickFromPool(mood){
  let m = mood;
  if (!adultMode && (m === "hot" || m === "intense")) m = "tease";
  const pool = videoPools[m] || videoPools.soft;
  const n = pool[Math.floor(Math.random()*pool.length)];
  return `assets/videos/${n}.mp4`;
}

function applyEffects(){
  const vi = parseFloat(intensity.value);
  const z = parseFloat(zoom.value);
  const f = `brightness(${0.92 + vi*0.1}) contrast(${1 + vi*0.25}) saturate(${1 + vi*0.3})`;
  front.style.filter = f;
  back.style.filter = f;
  front.style.transform = `scale(${z})`;
  back.style.transform = `scale(${z})`;
  intensityVal.textContent = vi.toFixed(2);
  zoomVal.textContent = z.toFixed(2);
}

function setVideo(src){
  back.src = src;
  back.load();
  back.oncanplay = () => {
    back.play().catch(()=>{});
    back.classList.add("active");
    front.classList.remove("active");
    [front, back] = [back, front];
    applyEffects();
  };
}

function nextVideoByMood(mood){
  setVideo(pickFromPool(mood));
}

// ================= VOZ =================
function hablar(text){
  if (!audioUnlocked) return;
  const u = new SpeechSynthesisUtterance(String(text||"").trim());
  u.lang = "es-419";
  u.rate = parseFloat(voiceRate.value);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function unlockAudio(){
  audioUnlocked = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  try { speechSynthesis.speak(u); } catch {}
}

// ================= UI sync =================
function syncModeUI(){
  modeAdult.classList.toggle("active", adultMode);
  modeNormal.classList.toggle("active", !adultMode);
  autoToggle.classList.toggle("active", autoMode);
  autoToggle.textContent = autoMode ? "ON" : "OFF";
  saveSettings();
}

modeNormal.addEventListener("click", ()=>{
  adultMode = false;
  syncModeUI();
  nextVideoByMood("soft");
});

modeAdult.addEventListener("click", ()=>{
  adultMode = true;
  syncModeUI();
  nextVideoByMood("tease");
});

autoToggle.addEventListener("click", ()=>{
  autoMode = !autoMode;
  syncModeUI();
});

forceNext.addEventListener("click", ()=>{
  nextVideoByMood(brain.mood);
});

// sliders
voiceRate.addEventListener("input", ()=>{
  voiceRateVal.textContent = parseFloat(voiceRate.value).toFixed(2);
  saveSettings();
});
intensity.addEventListener("input", ()=>{ applyEffects(); saveSettings(); });
zoom.addEventListener("input", ()=>{
  zoomVal.textContent = parseFloat(zoom.value).toFixed(2);
  applyEffects(); saveSettings();
});

// ================= API =================
async function callAPI(message, isAuto=false){
  const payload = {
    userId: USER_ID,
    message: String(message||"").trim(),
    mood: brain.mood,
    adult: adultMode,
    auto: !!isAuto
  };

  const r = await fetch(API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  const d = await r.json().catch(()=>({}));

  // tu worker devuelve reply
  if (d?.reply) hablar(d.reply);
  if (d?.mood) brain.mood = d.mood;

  nextVideoByMood(brain.mood);
  return d;
}

function sendUser(){
  const t = msg.value.trim();
  if (!t) return;
  msg.value = "";
  brain.lastUser = Date.now();

  if (isMenuOpen()) closeMenu();

  statusText.textContent = "Cara te escucha";
  callAPI(t, false).catch(()=>{});
  setTimeout(()=>{ statusText.textContent = "Cara está contigo"; }, 1200);
}

send.addEventListener("click", sendUser);
msg.addEventListener("keydown",(e)=>{ if(e.key==="Enter") sendUser(); });

// ================= INICIATIVA =================
// No spamear: sólo si idle > 25s y pasaron > 30s desde la última iniciativa
function tickInitiative(){
  if (!autoMode || !audioUnlocked) return;

  const now = Date.now();
  const idle = now - brain.lastUser;

  const minIdle = 25000;
  const minGap = 30000;

  if (idle > minIdle && (now - brain.lastAuto) > minGap){
    brain.lastAuto = now;
    statusText.textContent = "Cara toma la iniciativa";
    // Mensaje vacío controlado: el worker debe entender auto:true
    callAPI("...", true).catch(()=>{});
    setTimeout(()=>{ statusText.textContent = "Cara está contigo"; }, 1400);
  }
}

// ================= START =================
startBtn.addEventListener("click", ()=>{
  unlockAudio();
  start.style.display = "none";
  nextVideoByMood("soft");
  callAPI("Hola", false).catch(()=>{});
  setInterval(tickInitiative, 5000);
});

// init
loadSettings();
syncModeUI();
voiceRateVal.textContent = parseFloat(voiceRate.value).toFixed(2);
intensityVal.textContent = parseFloat(intensity.value).toFixed(2);
zoomVal.textContent = parseFloat(zoom.value).toFixed(2);
applyEffects();
closeMenu();
