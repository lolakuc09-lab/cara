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

const camVideo = document.getElementById("cam");

const msg = document.getElementById("msg");
const send = document.getElementById("send");
const micBtn = document.getElementById("micBtn");

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

// ➕ MODO AYUDA (botón)
const helpToggle = document.getElementById("helpToggle");

// ================= ESTADO =================
let audioUnlocked = false;
let brain = { mood:"soft", lastUser: Date.now(), lastAuto: 0 };

// ➕ MODO AYUDA (estado)
let helpMode = false;

// presencia (cámara)
let presence = {
  seen: false,
  distance: "unknown", // near | mid | far
  attention: false,
  motion: 0,
  lastSeenTs: 0
};

// ================= SETTINGS =================
const LS_KEY = "cara_settings_v7";
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
    adultMode, autoMode,
    voiceRate: parseFloat(voiceRate.value),
    intensity: parseFloat(intensity.value),
    zoom: parseFloat(zoom.value)
  }));
}

// ================= MENU =================
function isMenuOpen(){ return sideMenu.classList.contains("open"); }
function openMenu(){ sideMenu.classList.add("open"); menuBackdrop.classList.add("open"); }
function closeMenu(){ sideMenu.classList.remove("open"); menuBackdrop.classList.remove("open"); }
menuBtn.addEventListener("click",(e)=>{ e.preventDefault(); isMenuOpen()?closeMenu():openMenu(); });
menuBackdrop.addEventListener("click", closeMenu);

// ================= ➕ MODO AYUDA =================
if (helpToggle){
  helpToggle.addEventListener("click", ()=>{
    helpMode = !helpMode;
    helpToggle.classList.toggle("active", helpMode);

    // feedback suave
    if (audioUnlocked){
      if (helpMode) hablar("Estoy acá para ayudarte.");
      else hablar("Listo. Me quedo acompañándote.");
    }
  });
}

// ================= VIDEO =================
// 🔥 ÚNICA SECCIÓN MODIFICADA: ahora usa 40 videos
const videoPools = {
  idle:   [1,2,3,4,5,6,7,8],
  soft:   [9,10,11,12,13,14,15,16],
  tease:  [17,18,19,20,21,22,23,24],
  hot:    [25,26,27,28],
  intense:[29,30,31,32,33,34,35,36,37,38,39,40]
};

// Bolsas de reproducción sin repetición
const videoBags = {
  idle: [],
  soft: [],
  tease: [],
  hot: [],
  intense: []
};

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getNextFromBag(mood){
  let m = mood;
  if (!adultMode && (m==="hot"||m==="intense")) m="tease";

  if (!videoBags[m] || videoBags[m].length === 0) {
    // recargar bolsa mezclada
    videoBags[m] = shuffle([...videoPools[m]]);
  }

  const n = videoBags[m].pop();
  return `assets/videos/${n}.mp4`;
}

let lastAutoVideoChange = 0;

function pickFromPool(mood){
  return getNextFromBag(mood);
}

function applyEffects(){
  const vi = parseFloat(intensity.value);
  const z = parseFloat(zoom.value);
  const f = `brightness(${0.92 + vi*0.1}) contrast(${1 + vi*0.25}) saturate(${1 + vi*0.3})`;
  front.style.filter = f; back.style.filter = f;
  front.style.transform = `scale(${z})`; back.style.transform = `scale(${z})`;
  intensityVal.textContent = vi.toFixed(2);
  zoomVal.textContent = z.toFixed(2);
}

function setVideo(src){
  back.src = src; back.load();
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

// ================= 🎭 VIDEO SEGÚN PRESENCIA =================
function decideVideoByPresence(){
  const now = Date.now();
  if (now - lastAutoVideoChange < 4000) return; // no cambiar tan seguido

  let targetMood = brain.mood;

  if (!presence.seen){
    targetMood = "idle";
  } else {
    if (presence.distance === "near" && presence.attention){
      targetMood = adultMode ? "intense" : "tease";
    }
    else if (presence.distance === "near"){
      targetMood = "hot";
    }
    else if (presence.distance === "mid"){
      targetMood = "tease";
    }
    else if (presence.distance === "far"){
      targetMood = "soft";
    }

    if (presence.motion > 0.6){
      // inquieto → más teasing
      targetMood = "tease";
    }
  }

  if (targetMood !== brain.mood){
    brain.mood = targetMood;
    nextVideoByMood(brain.mood);
    lastAutoVideoChange = now;
  }
}

// ================= VOZ (TTS) =================
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

// ================= MIC (STT) =================
let recognition = null;
function setupSTT(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.style.display = "none";
    return;
  }
  recognition = new SR();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e)=>{
    const t = e.results[0][0].transcript || "";
    msg.value = t;
    sendUser();
  };
}
micBtn.addEventListener("click", ()=>{
  if (!recognition) return;
  try { recognition.start(); } catch {}
});

// ================= UI SYNC =================
function syncModeUI(){
  modeAdult.classList.toggle("active", adultMode);
  modeNormal.classList.toggle("active", !adultMode);
  autoToggle.classList.toggle("active", autoMode);
  autoToggle.textContent = autoMode ? "ON" : "OFF";
  saveSettings();
}
modeNormal.onclick = ()=>{ adultMode=false; syncModeUI(); };
modeAdult.onclick = ()=>{ adultMode=true; syncModeUI(); };
autoToggle.onclick = ()=>{ autoMode=!autoMode; syncModeUI(); };
forceNext.onclick = ()=>{ nextVideoByMood(brain.mood); };

voiceRate.oninput = ()=>{ voiceRateVal.textContent = (+voiceRate.value).toFixed(2); saveSettings(); };
intensity.oninput = ()=>{ applyEffects(); saveSettings(); };
zoom.oninput = ()=>{ zoomVal.textContent = (+zoom.value).toFixed(2); applyEffects(); saveSettings(); };

// ================= API =================
async function callAPI(message, isAuto=false){
  const payload = {
    userId: USER_ID,
    message: String(message||"").trim(),
    mood: brain.mood,
    adult: adultMode,
    auto: !!isAuto,

    // ➕ MODO AYUDA (flag para el Worker)
    help: helpMode,

    presence
  };
  const r = await fetch(API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const d = await r.json().catch(()=>({}));
  if (d?.reply) hablar(d.reply);
}

// ================= INPUT =================
function sendUser(){
  const t = msg.value.trim();
  if (!t) return;
  msg.value = "";
  brain.lastUser = Date.now();
  if (isMenuOpen()) closeMenu();
  statusText.textContent = "Cara te escucha";
  callAPI(t,false).catch(()=>{});
  setTimeout(()=> statusText.textContent="Cara está contigo", 1200);
}
send.onclick = sendUser;
msg.addEventListener("keydown",(e)=>{ if(e.key==="Enter") sendUser(); });

// ================= INICIATIVA =================
function tickInitiative(){
  if (!autoMode || !audioUnlocked) return;
  const now = Date.now();
  if ((now - brain.lastUser) > 25000 && (now - brain.lastAuto) > 30000){
    brain.lastAuto = now;
    callAPI("...", true).catch(()=>{});
  }
}

// ================= 👁️ CÁMARA =================
let faceDetector = null;
let camera = null;
let lastBoxArea = 0;

function setupCameraAndPresence(){
  try{
    faceDetector = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    faceDetector.setOptions({ model:'short', minDetectionConfidence:0.6 });
    faceDetector.onResults(onFaceResults);

    camera = new Camera(camVideo, {
      onFrame: async () => {
        if (faceDetector) await faceDetector.send({ image: camVideo });
      },
      width: 640,
      height: 480
    });

    camera.start();
  } catch(e){}
}

function onFaceResults(results){
  const faces = results.detections || [];
  if (faces.length > 0){
    presence.seen = true;
    presence.lastSeenTs = Date.now();

    const box = faces[0].boundingBox;
    const area = box.width * box.height;

    // distancia
    if (area > 0.18) presence.distance = "near";
    else if (area > 0.08) presence.distance = "mid";
    else presence.distance = "far";

    // atención
    presence.attention = area > 0.1;

    // movimiento
    const delta = Math.abs(area - lastBoxArea);
    presence.motion = Math.min(1, delta * 10);
    lastBoxArea = area;

    if (presence.attention) statusText.textContent = "Cara te está mirando";
    else statusText.textContent = "Cara te siente cerca";

  } else {
    if (Date.now() - presence.lastSeenTs > 4000){
      presence.seen = false;
      presence.attention = false;
      presence.distance = "unknown";
      presence.motion = 0;
      statusText.textContent = "Cara espera que vuelvas";
    }
  }

  decideVideoByPresence();
}

// ================= START =================
startBtn.addEventListener("click", ()=>{
  unlockAudio();
  start.style.display = "none";
  setupSTT();
  setupCameraAndPresence();
  nextVideoByMood("soft");
  callAPI("Hola", false).catch(()=>{});
  setInterval(tickInitiative, 5000);
});

// init
loadSettings();
syncModeUI();
voiceRateVal.textContent = (+voiceRate.value).toFixed(2);
intensityVal.textContent = (+intensity.value).toFixed(2);
zoomVal.textContent = (+zoom.value).toFixed(2);
applyEffects();
closeMenu();
