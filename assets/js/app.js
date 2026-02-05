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

// ➕ MODO AYUDA
const helpToggle = document.getElementById("helpToggle");

// ================= ESTADO =================
let audioUnlocked = false;
let brain = { mood:"soft", lastUser: Date.now(), lastAuto: 0 };
let helpMode = false;

// ================= PRESENCIA =================
let presence = {
  seen: false,
  distance: "unknown",
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
    adultMode,
    autoMode,
    voiceRate: parseFloat(voiceRate.value),
    intensity: parseFloat(intensity.value),
    zoom: parseFloat(zoom.value)
  }));
}

// ================= MENU =================
function isMenuOpen(){ return sideMenu.classList.contains("open"); }
function openMenu(){ sideMenu.classList.add("open"); menuBackdrop.classList.add("open"); }
function closeMenu(){ sideMenu.classList.remove("open"); menuBackdrop.classList.remove("open"); }

menuBtn.addEventListener("click",(e)=>{
  e.preventDefault();
  isMenuOpen() ? closeMenu() : openMenu();
});
menuBackdrop.addEventListener("click", closeMenu);

// ================= MODO AYUDA =================
if (helpToggle){
  helpToggle.addEventListener("click", ()=>{
    helpMode = !helpMode;
    helpToggle.classList.toggle("active", helpMode);
    if (audioUnlocked){
      hablar(helpMode ? "Estoy acá para ayudarte." : "Me quedo acompañándote.");
    }
  });
}

// ================= VIDEO (VIDEO ÚNICO) =================
const SINGLE_VIDEO_SRC = "assets/videos/1.mp4";

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

// Siempre el mismo video
function nextVideoByMood(){
  setVideo(SINGLE_VIDEO_SRC);
}

// Neutralizado
function decideVideoByPresence(){}

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

// ================= MIC =================
let recognition = null;
function setupSTT(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){
    micBtn.style.display = "none";
    return;
  }
  recognition = new SR();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e)=>{
    msg.value = e.results[0][0].transcript || "";
    sendUser();
  };
}

micBtn.addEventListener("click", ()=>{
  if (recognition) recognition.start();
});

// ================= UI =================
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
forceNext.onclick = ()=>{ nextVideoByMood(); };

voiceRate.oninput = ()=>{ voiceRateVal.textContent=(+voiceRate.value).toFixed(2); saveSettings(); };
intensity.oninput = ()=>{ applyEffects(); saveSettings(); };
zoom.oninput = ()=>{ zoomVal.textContent=(+zoom.value).toFixed(2); applyEffects(); saveSettings(); };

// ================= API =================
async function callAPI(message, isAuto=false){
  const payload = {
    userId: USER_ID,
    message: String(message||"").trim(),
    mood: brain.mood,
    adult: adultMode,
    auto: !!isAuto,
    help: helpMode,
    presence
  };

  const r = await fetch(API_URL,{
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
  setTimeout(()=>statusText.textContent="Cara está contigo",1200);
}

send.onclick = sendUser;
msg.addEventListener("keydown",(e)=>{ if(e.key==="Enter") sendUser(); });

// ================= INICIATIVA =================
function tickInitiative(){
  if (!autoMode || !audioUnlocked) return;
  const now = Date.now();
  if ((now-brain.lastUser)>25000 && (now-brain.lastAuto)>30000){
    brain.lastAuto = now;
    callAPI("...",true).catch(()=>{});
  }
}

// ================= CÁMARA =================
let faceDetector=null, camera=null;

function setupCameraAndPresence(){
  try{
    faceDetector = new FaceDetection({
      locateFile:(file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    faceDetector.setOptions({ model:'short', minDetectionConfidence:0.6 });
    faceDetector.onResults(()=>{});
    camera = new Camera(camVideo,{
      onFrame: async()=>{ if(faceDetector) await faceDetector.send({ image: camVideo }); },
      width:640,height:480
    });
    camera.start();
  }catch{}
}

// ================= START =================
startBtn.addEventListener("click", ()=>{
  unlockAudio();
  start.style.display="none";
  setupSTT();
  setupCameraAndPresence();
  nextVideoByMood();
  callAPI("Hola",false).catch(()=>{});
  setInterval(tickInitiative,5000);
});

// ================= INIT =================
loadSettings();
syncModeUI();
voiceRateVal.textContent=(+voiceRate.value).toFixed(2);
intensityVal.textContent=(+intensity.value).toFixed(2);
zoomVal.textContent=(+zoom.value).toFixed(2);
applyEffects();
closeMenu();
