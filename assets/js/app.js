const API_URL = "https://cara-api.fedegromero.workers.dev";

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

// ================= ESTADO =================
let audioUnlocked = false;
let brain = {
  mood: "soft"
};

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

function setVideo(src){
  back.src = src;
  back.load();
  back.oncanplay = () => {
    back.play().catch(()=>{});
    back.classList.add("active");
    front.classList.remove("active");
    [front, back] = [back, front];
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

  if (d?.text) hablar(d.text);
  if (d?.mood) brain.mood = d.mood;

  nextVideoByMood(brain.mood);
}

// ================= EVENTOS =================
function unlockAudio(){
  audioUnlocked = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

function sendUser(){
  const t = msg.value.trim();
  if (!t) return;
  msg.value = "";
  callAPI(t);
}

send.addEventListener("click", sendUser);
msg.addEventListener("keydown", (e)=>{ if (e.key === "Enter") sendUser(); });

startBtn.addEventListener("click", ()=>{
  unlockAudio();
  start.style.display = "none";
  nextVideoByMood("soft");   // 🔥 ARRANCA VIDEO REAL
  callAPI("Hola");
});
