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

// ================= ESTADO =================
let audioUnlocked = false;
let brain = { mood:"soft", lastUser: Date.now(), lastAuto: 0 };

// presencia (cámara)
let presence = {
  seen: false,
  distance: "unknown", // near | mid | far
  attention: false,
  lastSeenTs: 0
};

// ================= SETTINGS =================
const LS_KEY = "cara_settings_v6";
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
  if (!adultMode && (m==="hot"||m==="intense")) m="tease";
  const pool = videoPools[m] || videoPools.soft;
  const n = pool[Math.floor(Math.random()*pool.length)];
  return `assets/videos/${n}.mp4`;
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
function nextVideoByMood(mood){ setVideo(pickFromPool(mood)); }

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
  recognition.onerror = ()=>{};
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
modeNormal.onclick = ()=>{ adultMode=false; syncModeUI(); nextVideoByMood("soft"); };
modeAdult.onclick = ()=>{ adultMode=true; syncModeUI(); nextVideoByMood("tease"); };
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
    presence // enviamos señales de presencia (opcional para el backend)
  };
  const r = await fetch(API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const d = await r.json().catch(()=>({}));
  if (d?.reply) hablar(d.reply);
  if (d?.mood) brain.mood = d.mood;
  nextVideoByMood(brain.mood);
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

// ================= 👁️ CÁMARA / PRESENCIA =================
let faceDetector = null;
let camera = null;

function setupCameraAndPresence(){
  try{
    faceDetector = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    faceDetector.setOptions({
      model: 'short',
      minDetectionConfidence: 0.6
    });
    faceDetector.onResults(onFaceResults);

    camera = new Camera(camVideo, {
      onFrame: async () => {
        if (faceDetector) {
          await faceDetector.send({ image: camVideo });
        }
      },
      width: 640,
      height: 480
    });

    camera.start();
  } catch(e){
    console.warn("Cámara/presencia no disponible:", e);
  }
}

function onFaceResults(results){
  const faces = results.detections || [];
  if (faces.length > 0){
    presence.seen = true;
    presence.lastSeenTs = Date.now();

    const box = faces[0].boundingBox;
    const area = box.width * box.height;

    // heurística simple de distancia
    if (area > 0.18) presence.distance = "near";
    else if (area > 0.08) presence.distance = "mid";
    else presence.distance = "far";

    // atención: si la cara ocupa bastante área, asumimos que mira
    presence.attention = area > 0.1;

    // actualizar status visual
    if (presence.attention) {
      statusText.textContent = "Cara te está mirando";
    } else {
      statusText.textContent = "Cara te siente cerca";
    }
  } else {
    // si hace >5s que no ve cara
    if (Date.now() - presence.lastSeenTs > 5000){
      presence.seen = false;
      presence.attention = false;
      presence.distance = "unknown";
      statusText.textContent = "Cara espera que vuelvas";
    }
  }
}

// ================= START =================
startBtn.addEventListener("click", ()=>{
  unlockAudio();
  start.style.display = "none";
  setupSTT();
  setupCameraAndPresence(); // 👁️ cámara
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
