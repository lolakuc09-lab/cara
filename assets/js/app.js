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

// ================= ESTADO =================
let audioUnlocked = false;
let brain = { mood: "soft" };

// ================= MENU (FIX) =================
function isMenuOpen() {
  return sideMenu.classList.contains("open");
}

function openMenu() {
  sideMenu.classList.add("open");
  menuBackdrop.classList.add("open");
  menuBtn.setAttribute("aria-expanded", "true");
  sideMenu.setAttribute("aria-hidden", "false");
}

function closeMenu() {
  sideMenu.classList.remove("open");
  menuBackdrop.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
  sideMenu.setAttribute("aria-hidden", "true");
}

function toggleMenu() {
  if (isMenuOpen()) closeMenu();
  else openMenu();
}

menuBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleMenu();
});

menuBackdrop.addEventListener("click", () => {
  closeMenu();
});

// Cerrar con ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isMenuOpen()) closeMenu();
});

// Evitar que clicks dentro del menú cierren por bubbling
sideMenu.addEventListener("click", (e) => e.stopPropagation());

// ================= VIDEO =================
const videoPools = {
  idle:[1,2,3,4],
  soft:[5,6,7,8],
  tease:[9,10,11,12],
  hot:[13,14],
  intense:[15,16,17,18,19,20,21,22,23,24]
};

function pickFromPool(mood){
  const pool = videoPools[mood] || videoPools.soft;
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

// ================= API =================
async function callAPI(message){
  const payload = {
    userId: USER_ID,
    message: String(message||"").trim(),
    mood: brain.mood
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

// ================= EVENTOS =================
voiceRate.addEventListener("input", ()=> {
  voiceRateVal.textContent = parseFloat(voiceRate.value).toFixed(2);
});
intensity.addEventListener("input", applyEffects);
zoom.addEventListener("input", applyEffects);

function unlockAudio(){
  audioUnlocked = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  try { speechSynthesis.speak(u); } catch {}
}

function sendUser(){
  const t = msg.value.trim();
  if (!t) return;
  msg.value = "";

  // Cierra el menú al enviar (UX)
  if (isMenuOpen()) closeMenu();

  callAPI(t);
}

send.addEventListener("click", sendUser);
msg.addEventListener("keydown", (e)=>{ if (e.key === "Enter") sendUser(); });

startBtn.addEventListener("click", ()=>{
  unlockAudio();
  start.style.display = "none";
  nextVideoByMood("soft");
  callAPI("Hola");
});

// init UI
voiceRateVal.textContent = parseFloat(voiceRate.value).toFixed(2);
intensityVal.textContent = parseFloat(intensity.value).toFixed(2);
zoomVal.textContent = parseFloat(zoom.value).toFixed(2);
applyEffects();
closeMenu();
