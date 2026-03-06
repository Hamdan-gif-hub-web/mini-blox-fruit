// ============================================================
//  CORE SETUP
// ============================================================
let gameStarted = false

const game        = document.getElementById("game")
const world       = document.getElementById("world")
const player      = document.getElementById("player")
const attackSound = document.getElementById("attackSound")

const levelText   = document.getElementById("level")
const expText     = document.getElementById("exp")
const killsText   = document.getElementById("kills")
const moneyText   = document.getElementById("money")

const hpBar       = document.getElementById("playerHPBar")
const headHP      = document.getElementById("playerHeadHP")
const headName    = document.getElementById("playerHeadName")

const bossTimerText = document.getElementById("bossTimer")
const bossWarning   = document.getElementById("bossWarning")
const nameInputBox  = document.getElementById("nameInputBox")

let playerName = localStorage.getItem("playerName")
if(playerName){ nameInputBox.style.display="none"; headName.innerText=playerName; gameStarted=true }

function saveName(){
  playerName = document.getElementById("nameInput").value
  if(!playerName.trim()) return
  localStorage.setItem("playerName", playerName)
  headName.innerText = playerName
  nameInputBox.style.display = "none"
  gameStarted = true
}
function changeName(){ nameInputBox.style.display="block" }

let playerX=0, playerY=0, camX=0, camY=0, speed=8
let playerLevel = Number(localStorage.getItem("level"))||1
let playerEXP   = Number(localStorage.getItem("exp"))||0
let playerHP    = Number(localStorage.getItem("hp"))||100
let kills       = Number(localStorage.getItem("kills"))||0
let playerMoney = Number(localStorage.getItem("money"))||0

let enemies=[], boss=null

updateStats()
spawnEnemies()

function updateStats(){
  levelText.innerText  = playerLevel
  expText.innerText    = playerEXP
  killsText.innerText  = kills
  moneyText.innerText  = playerMoney
  hpBar.style.width    = Math.max(0,playerHP)+"%"
  headHP.style.width   = Math.max(0,playerHP)+"%"
  const hpColor = playerHP>60?"linear-gradient(90deg,#00cc44,#00ffaa)":playerHP>30?"linear-gradient(90deg,#ff9900,#ffcc00)":"linear-gradient(90deg,#ff2200,#ff6600)"
  hpBar.style.background = hpColor
  localStorage.setItem("level",  playerLevel)
  localStorage.setItem("exp",    playerEXP)
  localStorage.setItem("hp",     playerHP)
  localStorage.setItem("kills",  kills)
  localStorage.setItem("money",  playerMoney)
}

function updateCamera(){
  camX = playerX - window.innerWidth/2
  camY = playerY - window.innerHeight/2
  world.style.transform = `translate(${-camX}px,${-camY}px)`
}

// ── Movement ─────────────────────────────────────────────────
const keys = {}
document.addEventListener("keydown", e=>{
  keys[e.key] = true
  if(!gameStarted) return
  const hotkeys = ['1','2','3','4','5','6','7','8','9','0']
  const idx = hotkeys.indexOf(e.key)
  if(idx !== -1) activatePowerSlot(idx)
  if(e.key==="b"||e.key==="B") toggleShop()
})
document.addEventListener("keyup", e=>{ keys[e.key]=false })

setInterval(()=>{
  if(!gameStarted) return
  let moved=false
  if(keys["w"]||keys["ArrowUp"])    { playerY-=speed; moved=true }
  if(keys["s"]||keys["ArrowDown"])  { playerY+=speed; moved=true }
  if(keys["a"]||keys["ArrowLeft"])  { playerX-=speed; moved=true }
  if(keys["d"]||keys["ArrowRight"]) { playerX+=speed; moved=true }
  if(moved){ updateCamera(); if(powers.speedBoost?.active) vfxSpeedTrail() }
  if(powers.dash?.active){ playerX+=powers.dash.dx*powers.dash.sp; playerY+=powers.dash.dy*powers.dash.sp; updateCamera() }
},16)

// ── Spawn Enemies ─────────────────────────────────────────────
function spawnEnemies(){
  enemies.forEach(e=>e.element.remove()); enemies=[]
  const count = Math.ceil(playerLevel/5)+3
  for(let i=0;i<count;i++){
    const level = Math.floor(Math.random()*100)+1
    const hp    = 100+level*10
    const el    = document.createElement("div")
    el.className = "enemy"
    const x = playerX+(Math.random()*900-450)
    const y = playerY+(Math.random()*900-450)
    el.style.left = x+"px"; el.style.top = y+"px"
    el.innerHTML = `<div class="enemyName">Bandit Lv.${level}</div><div class="healthBar"><div class="hp"></div></div>`
    world.appendChild(el)
    enemies.push({element:el, x, y, hp, maxHP:hp, level, frozen:false})
  }
}

// ── Combat ────────────────────────────────────────────────────
document.addEventListener("click", e=>{
  if(shopOpen && document.getElementById("shopModal").contains(e.target)) return
  let dmg = 20+(powers.powerStrike?.active?40:0)+(powers_get("critBoost")?.owned?10:0)
  if(powers.shadowBlade?.active) dmg *= 2

  enemies.forEach(enemy=>{
    const rect = enemy.element.getBoundingClientRect()
    if(e.clientX>rect.left&&e.clientX<rect.right&&e.clientY>rect.top&&e.clientY<rect.bottom){
      if(enemy.frozen) dmg = Math.floor(dmg*1.5)
      hitEnemy(enemy, dmg)
    }
  })
  if(boss){
    const rect = boss.element.getBoundingClientRect()
    if(e.clientX>rect.left&&e.clientX<rect.right&&e.clientY>rect.top&&e.clientY<rect.bottom){
      let bd = 30+(powers.powerStrike?.active?60:0)+(powers_get("critBoost")?.owned?15:0)
      if(powers.shadowBlade?.active) bd*=2
      if(powers_get("bossSlayer")?.owned) bd*=5
      boss.hp -= bd; attackSound.currentTime=0; attackSound.play()
      effect(boss.x, boss.y); showDamage(boss.x, boss.y, bd)
      if(boss.hp<=0) killBoss()
      updateBossBar()
    }
  }
})

function hitEnemy(enemy, dmg){
  if(!enemy||!enemy.element?.parentNode) return
  enemy.hp -= dmg
  attackSound.currentTime=0; attackSound.play()
  effect(enemy.x, enemy.y)
  showDamage(enemy.x, enemy.y, dmg)
  if(enemy.hp<=0){
    vfxDeathBurst(enemy.x, enemy.y, "#ff4400")
    kills++; gainEXP(20); gainMoney(5)
    questOnEnemyKill()
    enemy.element.remove()
    enemies = enemies.filter(en=>en!==enemy)
    if(enemies.length===0) spawnEnemies()
  }
  updateEnemyBar(enemy)
  updateStats()
}

function gainMoney(amt){
  const mult = powers_get("goldenTouch")?.owned ? 3 : 1
  playerMoney += amt * mult
  updateStats()
}

function updateEnemyBar(enemy){
  const bar = enemy.element.querySelector(".hp")
  if(bar) bar.style.width=(Math.max(0,enemy.hp)/enemy.maxHP)*100+"%"
}

function gainEXP(amount){
  playerEXP += amount
  if(playerEXP>=100){
    playerEXP=0; playerLevel++
    if(playerLevel>100) playerLevel=100
    spawnEnemies()
    checkBadge(playerLevel)
  }
}

// ============================================================
//  BADGE SYSTEM
// ============================================================
const BADGE_DEFS = [
  { level:10,  icon:"🥉", name:"Rookie",      title:"Rookie Warrior",     color:"#cd7f32", glow:"#cd7f32", desc:"Reached Level 10" },
  { level:20,  icon:"🥈", name:"Soldier",     title:"Seasoned Soldier",   color:"#aaaaaa", glow:"#cccccc", desc:"Reached Level 20" },
  { level:30,  icon:"🥇", name:"Elite",       title:"Elite Fighter",      color:"#ffd700", glow:"#ffd700", desc:"Reached Level 30" },
  { level:40,  icon:"💎", name:"Diamond",     title:"Diamond Guard",      color:"#44ddff", glow:"#00eeff", desc:"Reached Level 40" },
  { level:50,  icon:"🔥", name:"Inferno",     title:"Inferno Knight",     color:"#ff6600", glow:"#ff4400", desc:"Reached Level 50" },
  { level:60,  icon:"⚡", name:"Thunder",     title:"Thunder Champion",   color:"#ffff00", glow:"#ffff00", desc:"Reached Level 60" },
  { level:70,  icon:"🌙", name:"Shadow",      title:"Shadow Lord",        color:"#aa44ff", glow:"#8800ff", desc:"Reached Level 70" },
  { level:80,  icon:"🌟", name:"Celestial",   title:"Celestial Hero",     color:"#88ffff", glow:"#00ffff", desc:"Reached Level 80" },
  { level:90,  icon:"👑", name:"Sovereign",   title:"Sovereign Ruler",    color:"#ff88ff", glow:"#ff00ff", desc:"Reached Level 90" },
  { level:100, icon:"🐉", name:"Legend",      title:"Legendary Dragon",   color:"#ff4400", glow:"#ff0000", desc:"Reached Level 100 — MAX!" },
]

let earnedBadges = JSON.parse(localStorage.getItem("earnedBadges")||"[]")

function checkBadge(level){
  const badge = BADGE_DEFS.find(b=>b.level===level)
  // Always show level-up animation
  showLevelUpOverlay(level, badge)
  if(!badge) return
  if(earnedBadges.includes(badge.level)) return
  earnedBadges.push(badge.level)
  localStorage.setItem("earnedBadges", JSON.stringify(earnedBadges))
  renderBadges(badge.level) // pass newly earned level so it flashes
}

// ── Canvas fireworks ─────────────────────────────────────────
function launchFireworks(canvas, color1, color2, duration=3000){
  const ctx = canvas.getContext("2d")
  canvas.width  = game.offsetWidth
  canvas.height = game.offsetHeight
  const particles = []

  function hex2rgb(hex){
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16)
    return `${r},${g},${b}`
  }

  function burst(x,y,color){
    const count = 60 + Math.floor(Math.random()*40)
    for(let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2
      const speed = 2 + Math.random()*6
      particles.push({
        x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        alpha:1, size:2+Math.random()*4,
        color:`rgba(${hex2rgb(color)},`, decay:0.012+Math.random()*0.018,
        gravity:0.08+Math.random()*0.05, trail:[]
      })
    }
  }

  // Launch multiple bursts over time
  const colors = [color1, color2, "#ffffff", "#ffff88"]
  let burstCount = 0
  const burstInterval = setInterval(()=>{
    const x = 80 + Math.random()*(canvas.width-160)
    const y = 60 + Math.random()*(canvas.height*0.6)
    burst(x, y, colors[burstCount % colors.length])
    burstCount++
  }, 280)

  burst(canvas.width/2, canvas.height*0.35, color1)
  burst(canvas.width/2 - 100, canvas.height*0.45, color2)
  burst(canvas.width/2 + 100, canvas.height*0.45, color1)

  const start = Date.now()
  function draw(){
    if(Date.now()-start > duration){ clearInterval(burstInterval); ctx.clearRect(0,0,canvas.width,canvas.height); return }
    ctx.clearRect(0,0,canvas.width,canvas.height)
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i]
      p.trail.push({x:p.x,y:p.y})
      if(p.trail.length>8) p.trail.shift()
      p.x+=p.vx; p.y+=p.vy; p.vy+=p.gravity; p.vx*=0.98; p.alpha-=p.decay
      if(p.alpha<=0){ particles.splice(i,1); continue }
      // trail
      p.trail.forEach((pt,ti)=>{
        ctx.beginPath(); ctx.arc(pt.x,pt.y,p.size*0.5,0,Math.PI*2)
        ctx.fillStyle=p.color+(p.alpha*(ti/p.trail.length)*0.4)+")"
        ctx.fill()
      })
      // main dot
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2)
      ctx.fillStyle=p.color+p.alpha+")"
      ctx.shadowColor=p.color+"1)"; ctx.shadowBlur=8
      ctx.fill(); ctx.shadowBlur=0
    }
    requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)
  setTimeout(()=>clearInterval(burstInterval), duration-200)
}

// ── Level-up full screen overlay ─────────────────────────────
function showLevelUpOverlay(level, badge){
  // Remove any existing one
  const old = document.getElementById("levelUpOverlay")
  if(old) old.remove()

  const overlay = document.createElement("div")
  overlay.id = "levelUpOverlay"

  // Canvas for fireworks
  const canvas = document.createElement("canvas")
  overlay.appendChild(canvas)

  const c1 = badge ? badge.color : "#00ffff"
  const c2 = badge ? badge.glow  : "#0088ff"

  if(badge){
    overlay.style.setProperty("--badge-color", badge.color)
    overlay.style.setProperty("--badge-glow",  badge.glow)

    // Orbiting sparks (4 of them at different rotations)
    const sparks = [0,90,180,270].map(deg=>{
      const orbit = document.createElement("div")
      orbit.className = "lvl-orbit"
      orbit.style.animationDuration = (1.2+Math.random()*0.4)+"s"
      orbit.style.transform = `rotate(${deg}deg)`
      const spark = document.createElement("div")
      spark.className = "lvl-spark"
      orbit.appendChild(spark)
      return orbit
    })

    overlay.innerHTML += `
      <div class="lvl-badge-wrap">
        <div class="lvl-glow-ring">
          ${sparks.map(s=>s.outerHTML).join("")}
          <div class="lvl-main-icon">${badge.icon}</div>
        </div>
        <div class="lvl-texts">
          <div class="lvl-up-word">⬆ LEVEL UP</div>
          <div class="lvl-number">${level}</div>
          <div class="lvl-badge-name">${badge.name}</div>
          <div class="lvl-badge-title">🏅 ${badge.title}</div>
        </div>
      </div>`
  } else {
    overlay.innerHTML += `
      <div class="lvl-badge-wrap">
        <div class="lvl-texts">
          <div class="lvl-up-word">⬆ LEVEL UP</div>
          <div class="lvl-plain-title">LEVEL ${level}</div>
          <div class="lvl-plain-sub">Keep fighting!</div>
        </div>
      </div>`
  }

  game.appendChild(overlay)

  // Start fireworks on the canvas
  launchFireworks(canvas, c1, c2, badge ? 3800 : 2000)

  // VFX in game world
  vfxShake(badge ? 16 : 8, badge ? 700 : 400)
  vfxScreenFlash(c1+"44", badge ? 600 : 300)
  vfxRing(playerX, playerY, c1, 200, 600, 5)
  if(badge){
    vfxRing(playerX, playerY, c2, 130, 450, 3)
    vfxParticles(playerX, playerY, 28, c1, 13, 1000, 180)
    vfxSpiral(c1, 280, 800)
  } else {
    vfxParticles(playerX, playerY, 14, c1, 9, 700, 100)
  }

  // Fade out and remove
  const dur = badge ? 3800 : 2200
  setTimeout(()=>{
    overlay.style.transition = "opacity 0.6s"
    overlay.style.opacity = "0"
    setTimeout(()=>overlay.remove(), 700)
  }, dur)
}

function renderBadges(justEarnedLevel=null){
  const panel = document.getElementById("badgePanel")
  if(!panel) return
  panel.innerHTML = ""
  BADGE_DEFS.forEach(badge=>{
    const earned = earnedBadges.includes(badge.level)
    const isNew  = badge.level === justEarnedLevel
    const div = document.createElement("div")
    div.className = "badgeItem" + (earned ? " earned" : " locked") + (isNew ? " justEarned" : "")
    if(earned){
      div.style.setProperty("--badge-glow",  badge.glow)
      div.style.setProperty("--badge-color", badge.color)
    }
    div.title = earned ? badge.title + " — " + badge.desc : "Reach Level " + badge.level + " to unlock"
    div.innerHTML = `
      <div class="badgeIcon">${earned ? badge.icon : "🔒"}</div>
      <div class="badgeLvl">Lv.${badge.level}</div>
      <div class="badgeName">${earned ? badge.name : "???"}</div>
    `
    div.onclick = ()=>{ if(earned) showBadgeDetail(badge) }
    panel.appendChild(div)
  })
}

function showBadgeDetail(badge){
  const existing = document.getElementById("badgeDetailPopup")
  if(existing) existing.remove()
  const el = document.createElement("div")
  el.id = "badgeDetailPopup"
  el.style.setProperty("--badge-glow", badge.glow)
  el.style.setProperty("--badge-color", badge.color)
  el.innerHTML = `
    <div class="bdp-icon">${badge.icon}</div>
    <div class="bdp-title">${badge.title}</div>
    <div class="bdp-desc">${badge.desc}</div>
    <button onclick="document.getElementById('badgeDetailPopup').remove()">✕ Close</button>
  `
  game.appendChild(el)
  setTimeout(()=>el?.remove(), 4000)
}

function toggleBadges(){
  const c = document.getElementById("badgeContainer")
  if(!c) return
  c.style.display = c.style.display==="none" ? "block" : "none"
}

// Seed existing level badges on load (in case player already leveled up before)
earnedBadges.forEach(lvl=>{})  // already stored
// Also check if current level qualifies for any badge not yet earned
BADGE_DEFS.forEach(b=>{ if(playerLevel>=b.level && !earnedBadges.includes(b.level)){ earnedBadges.push(b.level) } })
localStorage.setItem("earnedBadges", JSON.stringify(earnedBadges))

// Render on startup
setTimeout(renderBadges, 100)

// ── Enemy AI ──────────────────────────────────────────────────
function enemyFollow(){
  enemies.forEach(enemy=>{
    if(enemy.frozen) return
    const dx=playerX-enemy.x, dy=playerY-enemy.y, dist=Math.hypot(dx,dy)
    if(dist<600){ enemy.x+=dx/dist*1.5; enemy.y+=dy/dist*1.5; enemy.element.style.left=enemy.x+"px"; enemy.element.style.top=enemy.y+"px" }
  })
  if(boss&&!boss.frozen){ const dx=playerX-boss.x,dy=playerY-boss.y,dist=Math.hypot(dx,dy); boss.x+=dx/dist*1.2; boss.y+=dy/dist*1.2; boss.element.style.left=boss.x+"px"; boss.element.style.top=boss.y+"px" }
}

function enemyAttack(){
  if(powers.shield?.active) return
  enemies.forEach(enemy=>{
    if(enemy.frozen) return
    if(Math.hypot(playerX-enemy.x,playerY-enemy.y)<70){
      playerHP-=0.2
      if(playerHP<=0){ floatText("💀 YOU DIED!"); playerHP=100; playerEXP=0; vfxScreenFlash("#ff0000") }
      updateStats()
    }
  })
  if(boss&&!boss.frozen&&Math.hypot(playerX-boss.x,playerY-boss.y)<80){
    playerHP-=0.5
    if(playerHP<=0){ floatText("💀 BOSS GOT YOU!"); playerHP=100; vfxScreenFlash("#ff0000") }
    updateStats()
  }
}
setInterval(()=>{ enemyFollow(); enemyAttack() },30)

// ── Basic VFX ─────────────────────────────────────────────────
function effect(x,y){
  const fx=document.createElement("div"); fx.className="attackEffect"
  fx.style.left=x+"px"; fx.style.top=y+"px"
  world.appendChild(fx); setTimeout(()=>fx.remove(),350)
}

function showDamage(x,y,dmg){
  const el=document.createElement("div"); el.className="dmgFloat"
  el.innerText="-"+dmg; el.style.left=x+"px"; el.style.top=(y-20)+"px"
  if(dmg>=200) { el.style.color="#ff0"; el.style.fontSize="22px"; el.style.textShadow="0 0 10px #ff0" }
  if(dmg>=500) { el.style.color="#f0f"; el.style.fontSize="28px"; el.style.textShadow="0 0 16px #f0f" }
  world.appendChild(el); setTimeout(()=>el.remove(),900)
}

function floatText(msg){
  const el=document.createElement("div"); el.className="floatMsg"
  el.innerText=msg; game.appendChild(el); setTimeout(()=>el.remove(),2500)
}

// ============================================================
//  VFX ENGINE
// ============================================================

// Screen shake
function vfxShake(intensity=8, duration=400){
  const start=Date.now()
  const tick=setInterval(()=>{
    const t=Date.now()-start; if(t>duration){ game.style.transform=""; clearInterval(tick); return }
    const decay=1-t/duration
    const x=(Math.random()*2-1)*intensity*decay
    const y=(Math.random()*2-1)*intensity*decay
    game.style.transform=`translate(${x}px,${y}px)`
  },16)
}

// Full screen color flash overlay
function vfxScreenFlash(color="#ffffff", duration=300){
  const el=document.createElement("div")
  el.style.cssText=`position:absolute;inset:0;background:${color};pointer-events:none;z-index:800;animation:screenFlash ${duration}ms forwards`
  game.appendChild(el); setTimeout(()=>el.remove(), duration+50)
}

// Inject keyframe if not already added
;(()=>{
  const s=document.createElement("style"); s.id="vfxStyles"
  s.textContent=`
  @keyframes screenFlash{0%{opacity:0.6}100%{opacity:0}}
  @keyframes particleFly{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)}}
  @keyframes ringExpand{0%{transform:translate(-50%,-50%) scale(0);opacity:0.9}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
  @keyframes beamFade{0%{opacity:1;transform:scaleX(0)}50%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1)}}
  @keyframes auraPulse{0%,100%{opacity:0.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:0.9;transform:translate(-50%,-50%) scale(1.15)}}
  @keyframes orbFloat{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-80px) scale(0.3);opacity:0}}
  @keyframes spiralIn{0%{transform:translate(-50%,-50%) scale(3) rotate(0deg);opacity:0}100%{transform:translate(-50%,-50%) scale(1) rotate(720deg);opacity:1}}
  @keyframes groundCrack{0%{transform:translate(-50%,-50%) scale(0);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
  @keyframes lightningSpark{0%,100%{opacity:0}50%{opacity:1}}
  @keyframes cloudExpand{0%{transform:translate(-50%,-50%) scale(0.2);opacity:0.9}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
  @keyframes playerAura{0%,100%{box-shadow:var(--aura-a)}50%{box-shadow:var(--aura-b)}}
  @keyframes frozenShatter{0%{transform:scale(1) rotate(0deg);opacity:1}100%{transform:scale(2) rotate(45deg);opacity:0}}
  @keyframes regenPulse{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
  @keyframes nukeExplosion{0%{transform:translate(-50%,-50%) scale(0);opacity:1}60%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
  @keyframes timeStopWorld{0%{filter:saturate(1) brightness(1)}100%{filter:saturate(0) brightness(0.7)}}
  `
  document.head.appendChild(s)
})()

// Spawn particles bursting outward
function vfxParticles(x, y, count, color, size=8, duration=600, spread=120){
  for(let i=0;i<count;i++){
    const el=document.createElement("div")
    const angle=Math.random()*Math.PI*2
    const dist=Math.random()*spread+20
    const tx=Math.cos(angle)*dist, ty=Math.sin(angle)*dist
    el.style.cssText=`
      position:absolute;left:${x}px;top:${y}px;
      width:${size+Math.random()*size}px;height:${size+Math.random()*size}px;
      background:${color};border-radius:50%;pointer-events:none;
      --tx:${tx}px;--ty:${ty}px;
      animation:particleFly ${duration+Math.random()*200}ms ease-out forwards;
      box-shadow:0 0 6px ${color};z-index:5;`
    world.appendChild(el)
    setTimeout(()=>el.remove(), duration+300)
  }
}

// Expanding ring
function vfxRing(x, y, color, maxSize=200, duration=600, thick=4){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${x}px;top:${y}px;
    width:${maxSize}px;height:${maxSize}px;
    border:${thick}px solid ${color};border-radius:50%;pointer-events:none;
    animation:ringExpand ${duration}ms ease-out forwards;
    box-shadow:0 0 12px ${color},inset 0 0 12px ${color};z-index:5;`
  world.appendChild(el)
  setTimeout(()=>el.remove(), duration+50)
}

// Death burst of particles
function vfxDeathBurst(x,y,color){
  vfxParticles(x,y,12,color,10,700,100)
  vfxRing(x,y,color,80,400)
}

// Player aura overlay on the player element
function vfxPlayerAura(color1, color2, duration){
  player.style.setProperty("--aura-a",`0 0 20px ${color1}, 0 0 40px ${color1}66`)
  player.style.setProperty("--aura-b",`0 0 30px ${color2}, 0 0 60px ${color2}88`)
  player.style.animation=`rgbGlow 3s infinite linear, playerAura 0.6s infinite alternate`
  setTimeout(()=>{ player.style.animation="rgbGlow 3s infinite linear" },duration)
}

// Speed trail ghost
function vfxSpeedTrail(){
  const ghost=document.createElement("div")
  ghost.style.cssText=`position:absolute;left:${playerX-16}px;top:${playerY-24}px;width:32px;height:48px;
    opacity:0.3;background:rgba(0,200,255,0.3);border-radius:6px;pointer-events:none;
    transition:opacity 0.3s;z-index:1;`
  world.appendChild(ghost)
  setTimeout(()=>{ ghost.style.opacity="0"; setTimeout(()=>ghost.remove(),300) },50)
}

// Lightning bolt between two points in world-space
function vfxLightning(x1,y1,x2,y2,color="#ffff44"){
  const dx=x2-x1,dy=y2-y1
  const len=Math.hypot(dx,dy)
  const angle=Math.atan2(dy,dx)*180/Math.PI
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${x1}px;top:${y1}px;
    width:${len}px;height:3px;
    background:linear-gradient(90deg,${color},#fff,${color});
    transform-origin:left center;transform:rotate(${angle}deg);
    pointer-events:none;z-index:6;
    box-shadow:0 0 8px ${color},0 0 16px ${color};
    animation:lightningSpark 0.3s steps(2) forwards;`
  world.appendChild(el)
  setTimeout(()=>el.remove(),300)
}

// Ground crack circle
function vfxGroundCrack(x,y,color,size=300){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${x}px;top:${y}px;
    width:${size}px;height:${size}px;
    border:6px dashed ${color};border-radius:50%;pointer-events:none;
    animation:groundCrack 0.8s ease-out forwards;z-index:4;
    box-shadow:0 0 20px ${color};`
  world.appendChild(el)
  setTimeout(()=>el.remove(),900)
}

// Expanding cloud/explosion
function vfxCloud(x,y,color,size=250,duration=700){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${x}px;top:${y}px;
    width:${size}px;height:${size}px;
    background:radial-gradient(circle,${color}cc 0%,${color}44 50%,transparent 80%);
    border-radius:50%;pointer-events:none;
    animation:cloudExpand ${duration}ms ease-out forwards;z-index:5;`
  world.appendChild(el)
  setTimeout(()=>el.remove(),duration+50)
}

// Orb floating upward
function vfxOrb(x,y,color,text=""){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${x-20}px;top:${y-20}px;
    width:40px;height:40px;border-radius:50%;
    background:radial-gradient(circle,#fff 0%,${color} 50%,transparent 80%);
    pointer-events:none;z-index:6;font-size:20px;text-align:center;line-height:40px;
    box-shadow:0 0 16px ${color},0 0 32px ${color}88;
    animation:orbFloat 1s ease-out forwards;`
  el.innerText=text
  world.appendChild(el)
  setTimeout(()=>el.remove(),1100)
}

// Beam sweep
function vfxBeam(x,y,color,width=300){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${x}px;top:${y-20}px;
    width:${width}px;height:40px;
    background:linear-gradient(90deg,transparent,${color},#fff,${color},transparent);
    transform-origin:left center;pointer-events:none;z-index:6;
    animation:beamFade 0.5s ease-in-out forwards;
    box-shadow:0 0 20px ${color};`
  world.appendChild(el)
  setTimeout(()=>el.remove(),600)
}

// Spiral spiral in on player
function vfxSpiral(color,size=200,duration=600){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${playerX}px;top:${playerY}px;
    width:${size}px;height:${size}px;
    border:8px solid ${color};border-radius:50%;pointer-events:none;z-index:6;
    animation:spiralIn ${duration}ms ease-out forwards;
    box-shadow:0 0 20px ${color};`
  world.appendChild(el)
  setTimeout(()=>el.remove(),duration+50)
}

// Regen green cross
function vfxRegen(){
  const el=document.createElement("div")
  el.style.cssText=`
    position:absolute;left:${playerX}px;top:${playerY}px;
    width:80px;height:80px;pointer-events:none;z-index:6;
    animation:regenPulse 0.8s ease-out forwards;`
  el.innerHTML=`<svg viewBox="-40 -40 80 80" width="80" height="80">
    <rect x="-6" y="-30" width="12" height="60" fill="#00ff88" opacity="0.9"/>
    <rect x="-30" y="-6" width="60" height="12" fill="#00ff88" opacity="0.9"/>
  </svg>`
  world.appendChild(el)
  setTimeout(()=>el.remove(),900)
  vfxParticles(playerX,playerY,8,"#00ff88",8,700,60)
}

// Time-stop grayscale overlay
function vfxTimeStop(active){
  let overlay=document.getElementById("timeStopOverlay")
  if(active){
    if(!overlay){ overlay=document.createElement("div"); overlay.id="timeStopOverlay"; overlay.style.cssText="position:absolute;inset:0;pointer-events:none;z-index:50;background:rgba(0,0,50,0.2);transition:filter 0.5s"; game.appendChild(overlay) }
    overlay.style.filter="saturate(0.2) brightness(0.85)"; world.style.filter="saturate(0.15) brightness(0.8)"
  } else {
    if(overlay){ overlay.style.filter=""; overlay.remove() }
    world.style.filter=""
  }
}

// Nuke explosion
function vfxNuke(){
  vfxShake(25,800)
  vfxScreenFlash("#ff6600",500)
  vfxCloud(playerX,playerY,"#ff4400",800,900)
  vfxCloud(playerX,playerY,"#ff8800",600,700)
  vfxCloud(playerX,playerY,"#ffff00",300,500)
  vfxRing(playerX,playerY,"#ff6600",900,600,8)
  vfxParticles(playerX,playerY,30,"#ff4400",14,1000,400)
  vfxParticles(playerX,playerY,20,"#ffff00",10,900,300)
}

// God mode divine aura
function vfxGodMode(start){
  if(start){
    player.style.filter="drop-shadow(0 0 20px #fff) drop-shadow(0 0 40px #ffffaa) brightness(1.4)"
    vfxScreenFlash("#ffffff88",400)
    vfxParticles(playerX,playerY,16,"#ffffff",12,800,80)
    vfxRing(playerX,playerY,"#ffffaa",300,600)
  } else {
    player.style.filter=""
  }
}

// Freeze VFX
function vfxFreeze(){
  vfxScreenFlash("#aaddff55",400)
  vfxCloud(playerX,playerY,"#aaddff",400,700)
  vfxRing(playerX,playerY,"#44aaff",350,500,5)
  enemies.forEach(e=>{
    vfxParticles(e.x,e.y,6,"#aaddff",8,600,50)
    e.element.style.filter="brightness(1.6) saturate(0) hue-rotate(180deg)"
  })
}

// Dragon VFX
function vfxDragon(){
  vfxShake(12,600)
  vfxScreenFlash("#ff440044",300)
  for(let i=0;i<5;i++){
    setTimeout(()=>{
      const ex=playerX+(Math.random()*500-250), ey=playerY+(Math.random()*500-250)
      vfxCloud(ex,ey,"#ff4400",200,500)
      vfxParticles(ex,ey,8,"#ff6600",10,600,80)
    },i*80)
  }
  vfxBeam(playerX,playerY,"#ff4400",600)
}

// Meteor VFX
function vfxMeteor(){
  vfxShake(18,700)
  vfxScreenFlash("#ff220033",400)
  vfxCloud(playerX,playerY,"#ff2200",500,800)
  vfxRing(playerX,playerY,"#ff8800",500,600,6)
  vfxParticles(playerX,playerY,25,"#ff4400",12,900,250)
  vfxParticles(playerX,playerY,15,"#ffaa00",8,800,180)
}

// Vortex pull VFX
function vfxVortex(){
  for(let i=0;i<4;i++){
    setTimeout(()=>{
      vfxRing(playerX,playerY,"#8800ff",(4-i)*80,400,3)
    },i*80)
  }
  vfxParticles(playerX,playerY,16,"#aa44ff",10,700,120)
  vfxScreenFlash("#44008833",300)
}

// Dark matter black hole VFX
function vfxDarkMatter(){
  vfxShake(10,500)
  vfxCloud(playerX,playerY,"#220033",400,600)
  vfxRing(playerX,playerY,"#8800ff",300,400,5)
  vfxRing(playerX,playerY,"#aa00ff",200,500,3)
  vfxParticles(playerX,playerY,20,"#aa00ff",10,700,150)
}

// Thunder/lightning strike
function vfxThunder(targets){
  vfxShake(8,300)
  vfxScreenFlash("#ffff8844",200)
  targets.forEach((e,i)=>{
    setTimeout(()=>{
      vfxLightning(playerX,playerY,e.x,e.y,"#ffff44")
      vfxParticles(e.x,e.y,8,"#ffff44",8,500,60)
    },i*80)
  })
}

// Fireball VFX
function vfxFireball(targets){
  targets.forEach(e=>{
    vfxCloud(e.x,e.y,"#ff4400",150,500)
    vfxParticles(e.x,e.y,10,"#ff6600",10,600,80)
    vfxLightning(playerX,playerY,e.x,e.y,"#ff4400")
  })
}

// Shield bubble VFX
function vfxShieldUp(){
  vfxScreenFlash("#0088ff22",300)
  vfxRing(playerX,playerY,"#0088ff",120,500,5)
  vfxPlayerAura("#0088ff","#44aaff",4000)
  const bubble=document.createElement("div")
  bubble.id="shieldBubble"
  bubble.style.cssText=`position:absolute;left:${playerX-40}px;top:${playerY-50}px;
    width:80px;height:100px;border:3px solid #0088ff;border-radius:50%;pointer-events:none;z-index:6;
    background:rgba(0,136,255,0.08);box-shadow:0 0 20px #0088ff,inset 0 0 20px #0088ff44;
    animation:auraPulse 0.8s infinite;`
  world.appendChild(bubble)
  return bubble
}

// Poison cloud
function vfxPoison(){
  const cloud=document.createElement("div")
  cloud.id="poisonCloud"
  cloud.style.cssText=`position:absolute;left:${playerX-100}px;top:${playerY-100}px;
    width:200px;height:200px;border-radius:50%;pointer-events:none;z-index:4;
    background:radial-gradient(circle,#33ff4444 0%,#00cc2222 60%,transparent 80%);
    animation:auraPulse 1s infinite;`
  world.appendChild(cloud)
  return cloud
}

// Whirlwind VFX
function vfxWhirlwind(){
  for(let i=0;i<6;i++){
    setTimeout(()=>{
      const angle=i/6*Math.PI*2
      const rx=playerX+Math.cos(angle)*150, ry=playerY+Math.sin(angle)*150
      vfxParticles(rx,ry,5,"#88ddff",8,500,40)
      vfxLightning(playerX,playerY,rx,ry,"#88ccff")
    },i*60)
  }
  vfxRing(playerX,playerY,"#88ccff",300,500,4)
}

// Soul drain tendrils
function vfxSoulDrain(targets){
  targets.forEach(e=>{
    vfxLightning(playerX,playerY,e.x,e.y,"#aa00ff")
    vfxParticles(e.x,e.y,6,"#aa00ff",8,500,50)
  })
  vfxOrb(playerX,playerY,"#aa00ff","👻")
}

// Apocalypse wave VFX
function vfxApocalypse(){
  vfxShake(20,900)
  vfxScreenFlash("#ff000055",600)
  for(let r=50;r<=600;r+=80){
    setTimeout(()=>{ vfxRing(playerX,playerY,"#ff2200",r,400,5) },r/4)
  }
  vfxParticles(playerX,playerY,30,"#ff2200",14,1000,350)
}

// Reality break portal
function vfxRealityBreak(){
  vfxScreenFlash("#ffffff",500)
  vfxShake(15,600)
  vfxSpiral("#ff00ff",300,700)
  vfxSpiral("#00ffff",200,500)
  vfxParticles(playerX,playerY,20,"#ff88ff",10,800,120)
  vfxParticles(playerX,playerY,20,"#88ffff",10,800,120)
}

// Dash trail
function vfxDash(){
  for(let i=0;i<6;i++){
    setTimeout(()=>{ vfxParticles(playerX,playerY+i*10,3,"#00ffff",6,400,30) },i*30)
  }
  vfxBeam(playerX-100,playerY,"#00ffff88",200)
}

// Blink warp
function vfxBlink(ox,oy){
  vfxParticles(ox,oy,10,"#ffffff",8,500,60)
  vfxRing(ox,oy,"#ffffff",80,300,3)
  setTimeout(()=>{
    vfxParticles(playerX,playerY,10,"#00ffff",8,500,60)
    vfxRing(playerX,playerY,"#00ffff",80,300,3)
  },80)
}

// Chain lightning
function vfxChainLightning(targets){
  for(let i=0;i<targets.length-1;i++){
    vfxLightning(targets[i].x,targets[i].y,targets[i+1].x,targets[i+1].y,"#ffff44")
  }
  if(targets.length) vfxLightning(playerX,playerY,targets[0].x,targets[0].y,"#ffff44")
  vfxScreenFlash("#ffff4422",200)
}

// Omega strike crater
function vfxOmegaStrike(target){
  const x=target?target.x:playerX, y=target?target.y:playerY
  vfxShake(20,600)
  vfxScreenFlash("#ffffff",300)
  vfxCloud(x,y,"#ffffff",300,500)
  vfxCloud(x,y,"#ffff00",200,400)
  vfxParticles(x,y,20,"#ffffff",12,700,150)
  vfxRing(x,y,"#ffff00",350,500,6)
  vfxGroundCrack(x,y,"#ffcc00",300)
}

// Plague cloud
function vfxPlagueCloud(){
  const el=document.createElement("div")
  el.style.cssText=`position:absolute;left:${playerX-120}px;top:${playerY-120}px;
    width:240px;height:240px;border-radius:50%;pointer-events:none;z-index:5;
    background:radial-gradient(circle,#33ff6644 0%,#00cc4422 70%,transparent 100%);
    animation:cloudExpand 800ms ease-out forwards;`
  world.appendChild(el); setTimeout(()=>el.remove(),900)
  vfxParticles(playerX,playerY,15,"#33ff66",8,800,120)
}

// Rocketboots exhaust
function vfxRocketBoots(){
  vfxScreenFlash("#ff880022",200)
  vfxParticles(playerX,playerY+30,8,"#ff8800",10,500,60)
  vfxParticles(playerX,playerY+30,8,"#ffaa00",8,400,50)
}

// ── Boss ──────────────────────────────────────────────────────
function updateBossBar(){ if(!boss) return; boss.element.querySelector(".hp").style.width=(Math.max(0,boss.hp)/boss.maxHP)*100+"%" }
function showBossWarning(){ bossWarning.style.display="block"; setTimeout(()=>bossWarning.style.display="none",3000) }

let bossCountdown=300, bossActive=false

function startBossCountdown(){
  bossCountdown=300; bossTimerText.innerText="⏱ Boss in: "+bossCountdown+"s"
  const timer=setInterval(()=>{
    if(bossActive){ clearInterval(timer); return }
    bossCountdown--; bossTimerText.innerText="⏱ Boss in: "+bossCountdown+"s"
    if(bossCountdown<=0){ clearInterval(timer); showBossWarning(); setTimeout(()=>spawnBoss(),3000) }
  },1000)
}

function spawnBoss(){
  if(boss) return; bossActive=true
  const level=playerLevel, hp=2000+level*50
  const el=document.createElement("div"); el.className="boss"
  const x=playerX+(Math.random()*1000-500), y=playerY+(Math.random()*1000-500)
  el.style.left=x+"px"; el.style.top=y+"px"
  el.innerHTML=`<div class="enemyName">👑 BOSS Lv.${level}</div><div class="healthBar"><div class="hp"></div></div>`
  world.appendChild(el)
  boss={element:el,x,y,hp,maxHP:hp,level}; updateBossBar(); bossTimerText.innerText="💀 Boss Alive!"
  // Boss spawn VFX
  vfxShake(12,500)
  vfxRing(x,y,"#cc00ff",300,600,6)
  vfxParticles(x,y,20,"#cc00ff",12,800,150)
  vfxScreenFlash("#88008844",400)
}

function killBoss(){
  if(!boss) return
  vfxDeathBurst(boss.x,boss.y,"#cc00ff")
  vfxShake(20,800)
  vfxScreenFlash("#cc00ff44",500)
  vfxCloud(boss.x,boss.y,"#cc00ff",400,700)
  boss.element.remove(); boss=null; bossActive=false
  gainEXP(300); gainMoney(200)
  questOnBossKill(); startBossCountdown()
  floatText("👑 BOSS SLAIN! +200 coins")
}

startBossCountdown()


// ============================================================
//  QUEST SYSTEM
// ============================================================
const QUEST_TEMPLATES = [
  { type:"kill", target:"Bandit", desc:"Kill {n} Bandits",    range:[3,10],  xpR:25, moneyR:30  },
  { type:"kill", target:"any",    desc:"Defeat {n} Enemies",  range:[5,15],  xpR:20, moneyR:25  },
  { type:"kill", target:"Bandit", desc:"Slay {n} Bandits",    range:[10,25], xpR:22, moneyR:40  },
  { type:"boss", target:"Boss",   desc:"Defeat {n} Boss(es)", range:[1,3],   xpR:300,moneyR:500 },
  { type:"kill", target:"any",    desc:"Eliminate {n} Foes",  range:[8,20],  xpR:18, moneyR:35  },
]

let activeQuests=[], questIdCounter=0
const QUEST_SLOTS=3

function generateQuest(){
  const t=QUEST_TEMPLATES[Math.floor(Math.random()*QUEST_TEMPLATES.length)]
  const n=Math.floor(Math.random()*(t.range[1]-t.range[0]+1))+t.range[0]
  return { id:++questIdCounter, type:t.type, target:t.target, desc:t.desc.replace("{n}",n),
           goal:n, xp:n*t.xpR+Math.floor(Math.random()*30), money:t.moneyR+Math.floor(Math.random()*50), current:0, done:false }
}

function fillQuestSlots(){
  while(activeQuests.length<QUEST_SLOTS) activeQuests.push(generateQuest())
  renderQuests()
}

function questOnEnemyKill(){
  let ch=false
  activeQuests.forEach(q=>{ if(q.done) return; if(q.type==="kill"&&(q.target==="any"||q.target==="Bandit")){ q.current=Math.min(q.current+1,q.goal); ch=true; if(q.current>=q.goal) completeQuest(q) } })
  if(ch) renderQuests()
}

function questOnBossKill(){
  let ch=false
  activeQuests.forEach(q=>{ if(q.done) return; if(q.type==="boss"){ q.current=Math.min(q.current+1,q.goal); ch=true; if(q.current>=q.goal) completeQuest(q) } })
  if(ch) renderQuests()
}

function completeQuest(q){
  if(q.done) return; q.done=true
  gainEXP(q.xp); gainMoney(q.money)
  showQuestComplete(q)
  setTimeout(()=>{ activeQuests=activeQuests.filter(x=>x.id!==q.id); fillQuestSlots() },2200)
}

function renderQuests(){
  const panel=document.getElementById("questPanel"); if(!panel) return
  panel.innerHTML=""
  activeQuests.forEach(q=>{
    const pct=Math.round((q.current/q.goal)*100)
    const card=document.createElement("div"); card.className="questCard"+(q.done?" questDone":"")
    card.innerHTML=`
      <div class="questTitle">${q.done?"✅":"📋"} ${q.desc}</div>
      <div class="questProgress"><div class="questBar"><div class="questFill" style="width:${pct}%"></div></div><span class="questCount">${q.current}/${q.goal}</span></div>
      <div class="questRewards"><span class="qxp">⚡ +${q.xp} XP</span><span class="qmoney">🪙 +${q.money}</span></div>`
    panel.appendChild(card)
  })
}

function showQuestComplete(q){
  const el=document.createElement("div"); el.className="questCompletePopup"
  el.innerHTML=`🎉 Quest Complete!<br><small>${q.desc}</small><br><span class="qreward-row"><b>+${q.xp} XP</b> &nbsp; 🪙 <b>+${q.money} coins</b></span>`
  game.appendChild(el); setTimeout(()=>el.remove(),3000)
}

fillQuestSlots()


// ============================================================
//  50 POWERS SHOP SYSTEM
// ============================================================

const POWERS = [
  { id:"dash",         name:"Dash",            icon:"💨", cat:"Movement",  desc:"Burst forward at high speed",          cost:80,   cooldown:4000,  owned:false },
  { id:"blink",        name:"Blink",            icon:"✨", cat:"Movement",  desc:"Teleport 200px in random direction",   cost:150,  cooldown:6000,  owned:false },
  { id:"speedBoost",   name:"Speed Boost",      icon:"⚡", cat:"Movement",  desc:"Double movement speed for 5s",         cost:120,  cooldown:10000, owned:false },
  { id:"superJump",    name:"Super Jump",       icon:"🦘", cat:"Movement",  desc:"Leap away from all enemies",           cost:100,  cooldown:7000,  owned:false },
  { id:"phaseWalk",    name:"Phase Walk",       icon:"👻", cat:"Movement",  desc:"Move through enemies for 3s",          cost:200,  cooldown:12000, owned:false },
  { id:"windRun",      name:"Wind Run",         icon:"🌬️", cat:"Movement",  desc:"Increase speed +50% permanently",      cost:300,  cooldown:0,     owned:false, passive:true },
  { id:"rollDodge",    name:"Roll Dodge",       icon:"🔄", cat:"Movement",  desc:"Roll and evade damage for 1s",         cost:90,   cooldown:5000,  owned:false },
  { id:"teleSlash",    name:"Tele-Slash",       icon:"🌀", cat:"Movement",  desc:"Teleport to nearest enemy and slash",  cost:220,  cooldown:8000,  owned:false },
  { id:"afterimage",   name:"Afterimage",       icon:"🌫️", cat:"Movement",  desc:"Leave decoys that confuse enemies",    cost:180,  cooldown:9000,  owned:false },
  { id:"rocketBoots",  name:"Rocket Boots",     icon:"🚀", cat:"Movement",  desc:"Fly over map for 4s",                  cost:350,  cooldown:15000, owned:false },

  { id:"powerStrike",  name:"Power Strike",     icon:"⚔️", cat:"Attack",   desc:"Next 3 hits deal 3x damage",           cost:100,  cooldown:8000,  owned:false },
  { id:"shadowBlade",  name:"Shadow Blade",     icon:"🗡️", cat:"Attack",   desc:"Double all damage for 6s",             cost:200,  cooldown:12000, owned:false },
  { id:"multiHit",     name:"Multi Hit",        icon:"💥", cat:"Attack",   desc:"Hit all nearby enemies at once",        cost:150,  cooldown:6000,  owned:false },
  { id:"critBoost",    name:"Crit Boost",       icon:"🎯", cat:"Attack",   desc:"+10 bonus damage permanently",          cost:250,  cooldown:0,     owned:false, passive:true },
  { id:"explosiveHit", name:"Explosive Hit",    icon:"💣", cat:"Attack",   desc:"Each hit creates a small explosion",    cost:300,  cooldown:10000, owned:false },
  { id:"poisonBlade",  name:"Poison Blade",     icon:"☠️", cat:"Attack",   desc:"Enemies take 5 dmg/sec for 5s",        cost:180,  cooldown:8000,  owned:false },
  { id:"chainLightning",name:"Chain Lightning", icon:"⚡", cat:"Attack",   desc:"Lightning jumps between 3 enemies",     cost:280,  cooldown:10000, owned:false },
  { id:"berserker",    name:"Berserker",        icon:"😡", cat:"Attack",   desc:"10x damage for 4s",                    cost:200,  cooldown:15000, owned:false },
  { id:"deathMark",    name:"Death Mark",       icon:"💀", cat:"Attack",   desc:"1-shot kill next hit on enemy",         cost:350,  cooldown:20000, owned:false },
  { id:"whirlwind",    name:"Whirlwind",        icon:"🌪️", cat:"Attack",   desc:"Spin attack hits all surrounding foes", cost:220,  cooldown:9000,  owned:false },

  { id:"shield",       name:"Shield",           icon:"🛡️", cat:"Defense",  desc:"Block all damage for 4s",              cost:120,  cooldown:10000, owned:false },
  { id:"regen",        name:"Regen",            icon:"💊", cat:"Defense",  desc:"Heal 30 HP instantly",                  cost:80,   cooldown:8000,  owned:false },
  { id:"thorns",       name:"Thorns",           icon:"🌵", cat:"Defense",  desc:"Reflect damage to attackers for 6s",   cost:200,  cooldown:12000, owned:false },
  { id:"ironSkin",     name:"Iron Skin",        icon:"🪨", cat:"Defense",  desc:"Halve all incoming damage for 5s",     cost:160,  cooldown:11000, owned:false },
  { id:"lifeSteal",    name:"Life Steal",       icon:"🩸", cat:"Defense",  desc:"Steal HP from enemies on hit",         cost:220,  cooldown:10000, owned:false },
  { id:"barrierWall",  name:"Barrier Wall",     icon:"🔵", cat:"Defense",  desc:"Summon a wall that stops enemies 5s",  cost:300,  cooldown:14000, owned:false },
  { id:"invisibility", name:"Invisibility",     icon:"👁️", cat:"Defense",  desc:"Enemies can't target you 5s",         cost:350,  cooldown:18000, owned:false },
  { id:"rebound",      name:"Rebound",          icon:"↩️", cat:"Defense",  desc:"Knockback all enemies away from you",  cost:130,  cooldown:7000,  owned:false },
  { id:"autoHeal",     name:"Auto Heal",        icon:"💉", cat:"Defense",  desc:"+2 HP every second permanently",       cost:400,  cooldown:0,     owned:false, passive:true },
  { id:"fortress",     name:"Fortress Mode",    icon:"🏰", cat:"Defense",  desc:"Immovable and immune to damage 5s",    cost:280,  cooldown:16000, owned:false },

  { id:"freeze",       name:"Freeze",           icon:"❄️", cat:"Magic",    desc:"Freeze all enemies solid for 5s",      cost:160,  cooldown:10000, owned:false },
  { id:"fireball",     name:"Fireball",         icon:"🔥", cat:"Magic",    desc:"Explode 150 dmg to 3 enemies",         cost:140,  cooldown:7000,  owned:false },
  { id:"thunderStrike",name:"Thunder Strike",   icon:"🌩️", cat:"Magic",    desc:"Call lightning on 5 enemies",          cost:200,  cooldown:9000,  owned:false },
  { id:"vortex",       name:"Vortex",           icon:"🌀", cat:"Magic",    desc:"Pull all enemies to center",           cost:250,  cooldown:12000, owned:false },
  { id:"meteor",       name:"Meteor",           icon:"☄️", cat:"Magic",    desc:"Drop meteor 500 dmg in area",          cost:400,  cooldown:20000, owned:false },
  { id:"darkMatter",   name:"Dark Matter",      icon:"🌑", cat:"Magic",    desc:"Black hole damages all enemies",       cost:350,  cooldown:18000, owned:false },
  { id:"timeSlow",     name:"Time Slow",        icon:"⏳", cat:"Magic",    desc:"Slow all enemies for 7s",              cost:300,  cooldown:15000, owned:false },
  { id:"soulDrain",    name:"Soul Drain",       icon:"👾", cat:"Magic",    desc:"Drain 50 HP from nearby enemies",      cost:280,  cooldown:14000, owned:false },
  { id:"plagueCloud",  name:"Plague Cloud",     icon:"🟢", cat:"Magic",    desc:"Poison cloud deals DOT to all nearby", cost:230,  cooldown:11000, owned:false },
  { id:"mindControl",  name:"Mind Control",     icon:"🧠", cat:"Magic",    desc:"Turn 1 enemy into your ally 10s",     cost:500,  cooldown:25000, owned:false },

  { id:"nuke",         name:"Nuke",             icon:"💥", cat:"Ultimate", desc:"Instant kill ALL enemies on screen",   cost:1000, cooldown:60000, owned:false },
  { id:"godMode",      name:"God Mode",         icon:"😇", cat:"Ultimate", desc:"Invincible + 10x damage for 8s",       cost:1500, cooldown:90000, owned:false },
  { id:"timeStop",     name:"Time Stop",        icon:"🕐", cat:"Ultimate", desc:"Freeze everything for 10s",            cost:1200, cooldown:80000, owned:false },
  { id:"apocalypse",   name:"Apocalypse",       icon:"🌋", cat:"Ultimate", desc:"Wave of fire destroys all enemies",    cost:800,  cooldown:50000, owned:false },
  { id:"resurrection", name:"Resurrection",     icon:"🌟", cat:"Ultimate", desc:"Revive with full HP when you die",     cost:600,  cooldown:0,     owned:false, passive:true },
  { id:"bossSlayer",   name:"Boss Slayer",      icon:"👑", cat:"Ultimate", desc:"5x damage to bosses permanently",      cost:900,  cooldown:0,     owned:false, passive:true },
  { id:"goldenTouch",  name:"Golden Touch",     icon:"🪙", cat:"Ultimate", desc:"Kill money rewards tripled",           cost:700,  cooldown:0,     owned:false, passive:true },
  { id:"dragonsRage",  name:"Dragon's Rage",    icon:"🐉", cat:"Ultimate", desc:"Dragon blast 800 dmg to all foes",     cost:1100, cooldown:70000, owned:false },
  { id:"realityBreak", name:"Reality Break",    icon:"🌈", cat:"Ultimate", desc:"Reset all cooldowns + full heal",      cost:950,  cooldown:45000, owned:false },
  { id:"omegaStrike",  name:"Omega Strike",     icon:"⭐", cat:"Ultimate", desc:"Massive 1000 dmg to single enemy",     cost:1300, cooldown:60000, owned:false },
]

let ownedPowers    = JSON.parse(localStorage.getItem("ownedPowers")||"{}")
let powerCooldowns = {}
let shopOpen       = false
let equippedSlots  = JSON.parse(localStorage.getItem("equippedSlots")||"[]")
let shopFilter     = "All"

POWERS.forEach(p=>{ if(ownedPowers[p.id]) p.owned=true })

function applyPassives(){
  if(powers_get("windRun")?.owned) speed=12
  if(powers_get("autoHeal")?.owned){
    if(!window._autoHealRunning){ window._autoHealRunning=true; setInterval(()=>{ if(playerHP<100){ playerHP=Math.min(100,playerHP+2); updateStats() } },1000) }
  }
}

function powers_get(id){ return POWERS.find(p=>p.id===id) }

function toggleShop(){ shopOpen=!shopOpen; renderShop(); document.getElementById("shopModal").style.display=shopOpen?"flex":"none" }
function closeShop(){ shopOpen=false; document.getElementById("shopModal").style.display="none" }

function renderShop(){
  document.getElementById("shopMoneyDisplay").innerText="🪙 "+playerMoney
  const cats=["All","Movement","Attack","Defense","Magic","Ultimate"]
  document.getElementById("shopCatBar").innerHTML=cats.map(c=>`<button class="catBtn${shopFilter===c?" active":""}" onclick="shopFilter='${c}';renderShop()">${c}</button>`).join("")
  const filtered=shopFilter==="All"?POWERS:POWERS.filter(p=>p.cat===shopFilter)
  document.getElementById("shopGrid").innerHTML=filtered.map(p=>{
    const isEquipped=equippedSlots.includes(p.id)
    const cdLeft=powerCooldowns[p.id]?Math.ceil((powerCooldowns[p.id]-Date.now())/1000):0
    const canAfford=playerMoney>=p.cost
    let statusBtn=""
    if(!p.owned) statusBtn=`<button class="buyBtn${canAfford?"":" disabled"}" onclick="buyPower('${p.id}')">${canAfford?"🛒 Buy":"🔒"} 🪙${p.cost}</button>`
    else if(p.passive) statusBtn=`<span class="passiveTag">✅ PASSIVE</span>`
    else if(isEquipped) statusBtn=`<button class="unequipBtn" onclick="unequipPower('${p.id}')">✅ Equipped</button>`
    else if(equippedSlots.length<10) statusBtn=`<button class="equipBtn" onclick="equipPower('${p.id}')">➕ Equip</button>`
    else statusBtn=`<button class="equipBtn disabled">📦 Full</button>`
    return `<div class="shopCard${p.owned?" owned":""}${!canAfford&&!p.owned?" noafford":""}">
      <div class="shopIcon">${p.icon}</div><div class="shopName">${p.name}</div>
      <div class="shopCat">${p.cat}</div><div class="shopDesc">${p.desc}</div>
      ${!p.passive&&p.owned&&cdLeft>0?`<div class="cdTag">⏳ ${cdLeft}s</div>`:""}
      ${statusBtn}</div>`
  }).join("")
}

function buyPower(id){
  const p=powers_get(id); if(!p||p.owned||playerMoney<p.cost) return
  playerMoney-=p.cost; p.owned=true; ownedPowers[id]=true
  localStorage.setItem("ownedPowers",JSON.stringify(ownedPowers))
  updateStats(); applyPassives()
  floatText(`${p.icon} ${p.name} unlocked!`)
  // Buy VFX
  vfxParticles(playerX,playerY,12,"#ffd700",10,600,80)
  vfxRing(playerX,playerY,"#ffd700",100,400,3)
  renderShop(); renderHotbar()
}

function equipPower(id){
  if(equippedSlots.includes(id)||equippedSlots.length>=10) return
  equippedSlots.push(id); saveSlots(); renderShop(); renderHotbar()
}
function unequipPower(id){ equippedSlots=equippedSlots.filter(x=>x!==id); saveSlots(); renderShop(); renderHotbar() }
function saveSlots(){ localStorage.setItem("equippedSlots",JSON.stringify(equippedSlots)) }

function renderHotbar(){
  const bar=document.getElementById("hotbar"); bar.innerHTML=""
  equippedSlots.forEach((id,i)=>{
    const p=powers_get(id); if(!p) return
    const cdLeft=powerCooldowns[id]?Math.max(0,Math.ceil((powerCooldowns[id]-Date.now())/1000)):0
    const slot=document.createElement("div")
    slot.className="hotSlot"+(cdLeft>0?" onCd":"")
    slot.title=p.name+": "+p.desc
    slot.innerHTML=`<div class="hotIcon">${p.icon}</div><div class="hotKey">${i<9?i+1:0}</div>${cdLeft>0?`<div class="hotCd">${cdLeft}s</div>`:""}`
    slot.onclick=()=>activatePower(id)
    bar.appendChild(slot)
  })
}

function activatePowerSlot(idx){ const id=equippedSlots[idx]; if(id) activatePower(id) }

// ── Power state ────────────────────────────────────────────────
const powers = { dash:{active:false,dx:0,dy:0,sp:0}, powerStrike:{active:false,hits:0}, shadowBlade:{active:false}, shield:{active:false}, speedBoost:{active:false} }

// ── ACTIVATE POWER ─────────────────────────────────────────────
function activatePower(id){
  const p=powers_get(id); if(!p||!p.owned||p.passive) return
  const now=Date.now()
  if(powerCooldowns[id]&&now<powerCooldowns[id]){ floatText(`⏳ ${p.name} on cooldown!`); return }
  setCooldown(id,p.cooldown)
  floatText(`${p.icon} ${p.name}!`)

  switch(id){

    // ── MOVEMENT ──────────────────────────────────────────────
    case "dash":
      powers.dash.active=true; powers.dash.sp=22; powers.dash.dx=0; powers.dash.dy=-1
      vfxDash()
      setTimeout(()=>powers.dash.active=false,350); break

    case "blink":
      const ox=playerX,oy=playerY
      playerX+=Math.random()*300-150; playerY+=Math.random()*300-150; updateCamera()
      vfxBlink(ox,oy); break

    case "speedBoost":
      speed=20; powers.speedBoost.active=true
      vfxPlayerAura("#00ffff","#0088ff",5000)
      vfxRing(playerX,playerY,"#00ffff",100,400,3)
      setTimeout(()=>{ speed=powers_get("windRun")?.owned?12:8; powers.speedBoost.active=false },5000); break

    case "superJump":
      const jox=playerX,joy=playerY
      playerX+=Math.random()*400-200; playerY+=Math.random()*400-200; updateCamera()
      vfxParticles(jox,joy,12,"#88ff88",10,600,80)
      vfxRing(jox,joy,"#88ff88",120,400,3)
      vfxParticles(playerX,playerY,8,"#88ff88",8,500,60); break

    case "phaseWalk":
      enemies.forEach(e=>e.frozen=true)
      player.style.filter="drop-shadow(0 0 12px #ffffff) opacity(0.5)"
      vfxScreenFlash("#ffffff22",300)
      vfxParticles(playerX,playerY,10,"#ffffff",8,600,60)
      setTimeout(()=>{ enemies.forEach(e=>e.frozen=false); player.style.filter="" },3000); break

    case "rollDodge":
      powers.shield.active=true
      vfxRing(playerX,playerY,"#ffaa00",80,300,3)
      vfxParticles(playerX,playerY,8,"#ffaa00",8,400,50)
      setTimeout(()=>powers.shield.active=false,1000); break

    case "teleSlash":
      if(enemies.length){
        const t=enemies.reduce((a,b)=>Math.hypot(playerX-a.x,playerY-a.y)<Math.hypot(playerX-b.x,playerY-b.y)?a:b)
        const tsx=playerX,tsy=playerY
        vfxParticles(tsx,tsy,8,"#ff00ff",8,400,50)
        playerX=t.x; playerY=t.y; updateCamera()
        vfxRing(playerX,playerY,"#ff00ff",80,300,4)
        vfxParticles(playerX,playerY,10,"#ff00ff",10,500,60)
        hitEnemy(t,200)
      } break

    case "afterimage":
      for(let i=0;i<4;i++){
        const d=document.createElement("div"); d.className="enemy"
        d.style.cssText=`left:${playerX+(Math.random()*160-80)}px;top:${playerY+(Math.random()*160-80)}px;opacity:0.5;filter:hue-rotate(120deg)`
        world.appendChild(d); setTimeout(()=>d.remove(),3000)
        vfxParticles(playerX,playerY,4,"#aaffaa",6,400,40)
      } break

    case "rocketBoots":
      speed=32
      vfxRocketBoots()
      vfxPlayerAura("#ff8800","#ffcc00",4000)
      setInterval(()=>vfxParticles(playerX,playerY+24,3,"#ff8800",6,300,20),200)
      setTimeout(()=>speed=powers_get("windRun")?.owned?12:8,4000); break

    // ── ATTACK ─────────────────────────────────────────────────
    case "powerStrike":
      powers.powerStrike.active=true; powers.powerStrike.hits=3
      vfxPlayerAura("#ff4400","#ff8800",10000)
      vfxRing(playerX,playerY,"#ff4400",120,400,4)
      vfxParticles(playerX,playerY,12,"#ff4400",10,600,70)
      setTimeout(()=>powers.powerStrike.active=false,10000); break

    case "shadowBlade":
      powers.shadowBlade.active=true
      vfxPlayerAura("#220044","#8800ff",6000)
      vfxScreenFlash("#33003388",300)
      vfxParticles(playerX,playerY,16,"#8800ff",10,700,80)
      vfxRing(playerX,playerY,"#8800ff",150,500,4)
      setTimeout(()=>powers.shadowBlade.active=false,6000); break

    case "multiHit":
      const mhTargets=enemies.filter(e=>Math.hypot(playerX-e.x,playerY-e.y)<220)
      mhTargets.forEach(e=>{ hitEnemy(e,80); vfxParticles(e.x,e.y,6,"#ff8800",8,400,50) })
      vfxRing(playerX,playerY,"#ff8800",220,400,4)
      vfxShake(6,300); break

    case "explosiveHit":
      enemies.filter(e=>Math.hypot(playerX-e.x,playerY-e.y)<160).forEach(e=>{
        hitEnemy(e,100); vfxCloud(e.x,e.y,"#ff4400",120,400)
        vfxParticles(e.x,e.y,8,"#ffaa00",8,500,60)
      })
      vfxShake(8,350); break

    case "poisonBlade":
      const poisonEl=vfxPoison()
      enemies.forEach(e=>{
        let ticks=5; e.element.style.filter="hue-rotate(90deg) brightness(1.3)"
        const iv=setInterval(()=>{ hitEnemy(e,5); if(--ticks<=0){ clearInterval(iv); e.element&&(e.element.style.filter="") } },1000)
        vfxParticles(e.x,e.y,4,"#33ff66",6,400,40)
      })
      setTimeout(()=>poisonEl.remove(),5000); break

    case "chainLightning":
      const clTargets=enemies.slice(0,3)
      clTargets.forEach(e=>hitEnemy(e,120))
      vfxChainLightning(clTargets)
      vfxShake(6,200); break

    case "berserker":
      powers.shadowBlade.active=true
      vfxPlayerAura("#ff0000","#ff6600",4000)
      vfxScreenFlash("#ff000033",300)
      vfxParticles(playerX,playerY,16,"#ff0000",12,700,80)
      setTimeout(()=>powers.shadowBlade.active=false,4000); break

    case "deathMark":
      if(enemies.length){
        const dm=enemies[0]
        vfxRing(dm.x,dm.y,"#ff0000",60,200,4)
        vfxParticles(dm.x,dm.y,10,"#ff0000",10,400,50)
        setTimeout(()=>hitEnemy(dm,99999),300)
      } break

    case "whirlwind":
      enemies.filter(e=>Math.hypot(playerX-e.x,playerY-e.y)<260).forEach(e=>hitEnemy(e,90))
      vfxWhirlwind()
      vfxShake(8,400); break

    // ── DEFENSE ────────────────────────────────────────────────
    case "shield":
      powers.shield.active=true
      const shieldBubble=vfxShieldUp()
      shieldBubble.style.left=(playerX-40)+"px"; shieldBubble.style.top=(playerY-50)+"px"
      setTimeout(()=>{ powers.shield.active=false; shieldBubble.remove() },4000); break

    case "regen":
      playerHP=Math.min(100,playerHP+30); updateStats()
      vfxRegen(); break

    case "thorns":
      powers.shield.active=true
      vfxPlayerAura("#00aa44","#00ff66",6000)
      vfxRing(playerX,playerY,"#00ff66",120,400,3)
      vfxParticles(playerX,playerY,12,"#00ff66",8,600,70)
      setTimeout(()=>powers.shield.active=false,6000); break

    case "ironSkin":
      powers.shield.active=true
      vfxPlayerAura("#888888","#aaaaaa",5000)
      vfxRing(playerX,playerY,"#aaaaaa",120,400,5)
      vfxScreenFlash("#88888822",300)
      setTimeout(()=>powers.shield.active=false,5000); break

    case "lifeSteal":
      enemies.filter(e=>Math.hypot(playerX-e.x,playerY-e.y)<160).forEach(e=>{
        hitEnemy(e,30); playerHP=Math.min(100,playerHP+10)
        vfxLightning(playerX,playerY,e.x,e.y,"#ff0088")
      })
      updateStats()
      vfxOrb(playerX,playerY,"#ff0088","❤️"); break

    case "barrierWall":
      enemies.forEach(e=>e.frozen=true)
      vfxRing(playerX,playerY,"#0088ff",300,600,6)
      vfxScreenFlash("#0044ff22",300)
      for(let i=0;i<8;i++) vfxOrb(playerX+(Math.cos(i/8*Math.PI*2)*150),playerY+(Math.sin(i/8*Math.PI*2)*150),"#0088ff","🔵")
      setTimeout(()=>enemies.forEach(e=>e.frozen=false),5000); break

    case "invisibility":
      player.style.opacity="0.15"
      enemies.forEach(e=>e.frozen=true)
      vfxScreenFlash("#ffffff44",400)
      vfxParticles(playerX,playerY,16,"#ffffff",8,600,80)
      setTimeout(()=>{ player.style.opacity="1"; enemies.forEach(e=>e.frozen=false) },5000); break

    case "rebound":
      enemies.forEach(e=>{
        const dx=e.x-playerX, dy=e.y-playerY, dist=Math.hypot(dx,dy)
        e.x+=dx/dist*320; e.y+=dy/dist*320
        e.element.style.left=e.x+"px"; e.element.style.top=e.y+"px"
        vfxLightning(playerX,playerY,e.x,e.y,"#ffffff")
      })
      vfxRing(playerX,playerY,"#ffffff",300,400,5)
      vfxShake(8,300); break

    case "fortress":
      powers.shield.active=true; speed=0
      vfxPlayerAura("#888800","#ffff00",5000)
      vfxRing(playerX,playerY,"#ffff00",140,400,5)
      vfxScreenFlash("#ffff0022",300)
      setTimeout(()=>{ powers.shield.active=false; speed=powers_get("windRun")?.owned?12:8 },5000); break

    // ── MAGIC ──────────────────────────────────────────────────
    case "freeze":
      vfxFreeze()
      enemies.forEach(e=>{ e.frozen=true })
      setTimeout(()=>enemies.forEach(e=>{ e.frozen=false; e.element&&(e.element.style.filter="") }),5000); break

    case "fireball":
      const fbTargets=enemies.slice(0,3)
      fbTargets.forEach(e=>hitEnemy(e,150))
      vfxFireball(fbTargets)
      vfxShake(8,350); break

    case "thunderStrike":
      const tsTargets=enemies.slice(0,5)
      tsTargets.forEach(e=>hitEnemy(e,80))
      vfxThunder(tsTargets)
      vfxShake(10,300); break

    case "vortex":
      enemies.forEach(e=>{
        e.x=playerX+(Math.random()*80-40); e.y=playerY+(Math.random()*80-40)
        e.element.style.left=e.x+"px"; e.element.style.top=e.y+"px"
        e.frozen=true; setTimeout(()=>e.frozen=false,3000)
      })
      vfxVortex(); break

    case "meteor":
      enemies.filter(e=>Math.hypot(playerX-e.x,playerY-e.y)<350).forEach(e=>hitEnemy(e,500))
      vfxMeteor(); break

    case "darkMatter":
      enemies.forEach(e=>hitEnemy(e,200))
      vfxDarkMatter()
      vfxShake(12,500); break

    case "timeSlow":
      enemies.forEach(e=>e.frozen=true)
      vfxTimeStop(true)
      vfxRing(playerX,playerY,"#4444ff",300,600,4)
      vfxParticles(playerX,playerY,14,"#8888ff",10,700,100)
      setTimeout(()=>{ enemies.forEach(e=>e.frozen=false); vfxTimeStop(false) },7000); break

    case "soulDrain":
      const sdTargets=enemies.filter(e=>Math.hypot(playerX-e.x,playerY-e.y)<220)
      sdTargets.forEach(e=>{ hitEnemy(e,50); playerHP=Math.min(100,playerHP+5) })
      updateStats()
      vfxSoulDrain(sdTargets); break

    case "plagueCloud":
      vfxPlagueCloud()
      enemies.forEach(e=>{
        let t=5; e.element.style.filter="hue-rotate(100deg)"
        const iv=setInterval(()=>{ hitEnemy(e,15); if(--t<=0){ clearInterval(iv); e.element&&(e.element.style.filter="") } },800)
        vfxParticles(e.x,e.y,4,"#33ff66",6,400,40)
      }); break

    case "mindControl":
      if(enemies.length){
        const mc=enemies[0]; mc.frozen=true
        mc.element.style.filter="hue-rotate(120deg) brightness(1.4)"
        vfxLightning(playerX,playerY,mc.x,mc.y,"#ff00ff")
        vfxRing(mc.x,mc.y,"#ff00ff",60,300,3)
        vfxOrb(mc.x,mc.y,"#ff00ff","🧠")
        setTimeout(()=>{ mc.frozen=false; mc.element&&(mc.element.style.filter="") },10000)
      } break

    // ── ULTIMATE ───────────────────────────────────────────────
    case "nuke":
      vfxNuke()
      setTimeout(()=>[...enemies].forEach(e=>hitEnemy(e,99999)),400); break

    case "godMode":
      powers.shield.active=true; powers.shadowBlade.active=true
      vfxGodMode(true)
      vfxRing(playerX,playerY,"#ffffff",200,500,6)
      setTimeout(()=>{ powers.shield.active=false; powers.shadowBlade.active=false; vfxGodMode(false) },8000); break

    case "timeStop":
      enemies.forEach(e=>e.frozen=true); if(boss) boss.frozen=true
      vfxTimeStop(true)
      vfxShake(10,500)
      vfxScreenFlash("#0000ff33",500)
      vfxRing(playerX,playerY,"#4444ff",400,700,6)
      for(let i=1;i<=5;i++) setTimeout(()=>vfxRing(playerX,playerY,"#2222ff",i*80,400,2),i*80)
      setTimeout(()=>{ enemies.forEach(e=>e.frozen=false); if(boss) boss.frozen=false; vfxTimeStop(false) },10000); break

    case "apocalypse":
      vfxApocalypse()
      setTimeout(()=>[...enemies].forEach(e=>hitEnemy(e,800)),300); break

    case "dragonsRage":
      vfxDragon()
      setTimeout(()=>{
        [...enemies].forEach(e=>hitEnemy(e,800))
        if(boss){ boss.hp-=800; updateBossBar() }
      },200); break

    case "realityBreak":
      powerCooldowns={}; playerHP=100; updateStats()
      vfxRealityBreak()
      renderHotbar(); break

    case "omegaStrike":
      const tgt=enemies.length?enemies[0]:null
      vfxOmegaStrike(tgt)
      setTimeout(()=>{
        if(tgt) hitEnemy(tgt,1000)
        else if(boss){ boss.hp-=1000; updateBossBar() }
      },300); break
  }
  renderHotbar()
}

function setCooldown(id,ms){
  if(!ms) return
  powerCooldowns[id]=Date.now()+ms
  setTimeout(()=>{ renderHotbar(); if(shopOpen) renderShop() },ms)
  const tick=setInterval(()=>{ renderHotbar(); if(Date.now()>=powerCooldowns[id]) clearInterval(tick) },1000)
}

applyPassives()
renderHotbar()
setInterval(renderHotbar,1000)