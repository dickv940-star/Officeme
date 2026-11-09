/* OfficeMe unified entrance — visual transition only; AI execution remains backend-driven. */
(() => {
  "use strict";
  if (document.getElementById("officeMeEntrance")) return;

  const agents = [
    ["Alexander","Data Analyst","alexander-data-analyst.png"],
    ["Olivia","Product Researcher","olivia-product-researcher.png"],
    ["Ethan","Growth Strategist","ethan-marketing-strategist.png"],
    ["Sophia","Content Creator","sophia-content-creator.png"],
    ["Daniel","SEO Specialist","daniel-seo-specialist.png"],
    ["Isabella","Visual Designer","isabella-graphic-designer.png"],
    ["Lucas","Automation Engineer","lucas-automation-engineer.png"],
    ["Charlotte","Quality Controller","charlotte-quality-controller.png"]
  ];
  const style = document.createElement("style");
  style.id = "officeMeEntranceStyles";
  style.textContent = `
    #officeMeEntrance{position:fixed;inset:0;z-index:100001;display:grid;place-items:center;overflow:hidden;
      color:#f4f7ff;background:radial-gradient(ellipse at 50% 35%,#294b68 0,#14283e 42%,#081321 100%);
      isolation:isolate;opacity:1;transition:opacity .85s ease,visibility .85s ease}
    #officeMeEntrance[hidden]{display:none}
    #officeMeEntrance:before{content:"";position:absolute;inset:0;z-index:-1;opacity:.24;
      background:linear-gradient(90deg,transparent 49.8%,#9bc8e7 50%,transparent 50.2%),
      repeating-linear-gradient(0deg,transparent 0 79px,#8bb6d322 80px),linear-gradient(180deg,#10243a,#07111e)}
    #officeMeEntrance .ome-content{width:min(100% - 32px,980px);display:grid;justify-items:center;gap:22px;text-align:center}
    #officeMeEntrance .ome-brand{font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#a9c9e5;font-weight:800}
    #officeMeEntrance h1{font-size:clamp(30px,5vw,58px);line-height:1.03;letter-spacing:-.055em;margin:0;text-shadow:0 8px 35px #0008}
    #officeMeEntrance .ome-sub{max-width:600px;color:#b7c9da;margin:0;font-size:14px}
    #officeMeEntrance .ome-stage{position:relative;width:min(100%,690px);height:clamp(290px,47vh,440px);perspective:1500px;isolation:isolate}
    #officeMeEntrance .ome-glow{position:absolute;inset:12% 18%;background:#64c9ff;filter:blur(75px);opacity:.17;border-radius:50%}
    #officeMeEntrance .ome-room{position:absolute;inset:5% 17%;overflow:hidden;border:1px solid #9ec9e85c;
      border-radius:8px;background:linear-gradient(180deg,#8dbbd0 0%,#c5dce0 42%,#314c60 43%,#142b40 100%);
      box-shadow:0 25px 80px #0009,inset 0 0 55px #07111f66}
    #officeMeEntrance .ome-window{position:absolute;left:8%;right:8%;top:8%;height:34%;border:7px solid #58768a;
      background:linear-gradient(135deg,#a8d9e5,#e3f0e8 55%,#83b5c8);box-shadow:0 7px 0 #263e53}
    #officeMeEntrance .ome-floor{position:absolute;bottom:0;left:0;right:0;height:35%;
      background:repeating-linear-gradient(90deg,#795b49 0 48px,#89694f 49px 52px);border-top:8px solid #b18a65}
    #officeMeEntrance .ome-desk{position:absolute;left:20%;right:20%;bottom:25%;height:18px;background:#6d4935;border-radius:5px;box-shadow:0 12px 0 #3b2c27}
    #officeMeEntrance .ome-monitor{position:absolute;left:43%;bottom:37%;width:62px;height:48px;border:6px solid #233c52;border-radius:5px;background:linear-gradient(135deg,#65e3db,#267c9b);box-shadow:0 0 25px #56e5df88}
    #officeMeEntrance .ome-workers{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:space-evenly;padding:0 5% 16%;z-index:2}
    #officeMeEntrance .ome-worker{width:10%;max-width:58px;display:grid;justify-items:center;gap:4px;animation:omeFloat 2.8s ease-in-out infinite;animation-delay:var(--delay)}
    #officeMeEntrance .ome-worker img{width:100%;aspect-ratio:1;object-fit:cover;object-position:top;border-radius:13px;border:2px solid #e1f4ff;box-shadow:0 5px 16px #06101b99}
    #officeMeEntrance .ome-worker i{display:block;width:125%;height:5px;border-radius:9px;background:#b7d4e6;box-shadow:0 4px 0 #536b7c}
    #officeMeEntrance .ome-door{position:absolute;inset:0;z-index:5;display:grid;grid-template-columns:1fr 1fr;transform-style:preserve-3d;pointer-events:auto;cursor:pointer}
    #officeMeEntrance .ome-leaf{position:relative;overflow:hidden;border:2px solid #b98c5c;background:
      linear-gradient(90deg,#4b3329 0%,#9b704e 10%,#6e4935 48%,#3a2b27 100%);
      box-shadow:inset 0 0 0 8px #2d2929,inset 0 0 0 12px #c69a68,0 15px 45px #0009;transform-style:preserve-3d;transition:transform 1.45s cubic-bezier(.2,.72,.16,1)}
    #officeMeEntrance .ome-leaf:before{content:"";position:absolute;inset:10% 12%;border:3px solid #c69a68;
      background:linear-gradient(145deg,#805a3e,#4d342b 55%,#765139);box-shadow:inset 0 0 0 7px #533a2e,inset 0 0 0 10px #a77b51}
    #officeMeEntrance .ome-leaf:after{content:"";position:absolute;top:50%;width:10px;height:10px;border-radius:50%;background:#f3d28d;box-shadow:0 0 14px #ffd98c}
    #officeMeEntrance .ome-leaf.left{transform-origin:left center;border-right:3px solid #d0a16c}
    #officeMeEntrance .ome-leaf.right{transform-origin:right center;border-left:3px solid #d0a16c}
    #officeMeEntrance .ome-leaf.left:after{right:9%}#officeMeEntrance .ome-leaf.right:after{left:9%}
    #officeMeEntrance.is-opening .ome-leaf.left{transform:rotateY(-108deg)}
    #officeMeEntrance.is-opening .ome-leaf.right{transform:rotateY(108deg)}
    #officeMeEntrance.is-opening .ome-room{box-shadow:0 0 90px #83d8ff88}
    #officeMeEntrance.is-leaving{opacity:0;visibility:hidden;pointer-events:none}
    #officeMeEntrance .ome-enter{border:1px solid #a8d7f5;background:linear-gradient(135deg,#b9e5ff,#83b9e8);color:#0a1b2c;
      padding:14px 25px;border-radius:999px;font-weight:900;letter-spacing:.04em;cursor:pointer;box-shadow:0 10px 30px #4ba8e855;
      transition:transform .2s,filter .2s}
    #officeMeEntrance .ome-enter:hover{transform:translateY(-2px);filter:brightness(1.08)}
    #officeMeEntrance .ome-enter:focus-visible{outline:3px solid #fff;outline-offset:4px}
    #officeMeEntrance .ome-foot{font-size:11px;color:#7f9bb3}
    @keyframes omeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @media(max-width:600px){#officeMeEntrance .ome-stage{height:300px}#officeMeEntrance .ome-room{inset:8% 5%}
      #officeMeEntrance .ome-worker{width:11%}#officeMeEntrance .ome-workers{padding-bottom:19%}
      #officeMeEntrance .ome-door .ome-leaf{box-shadow:inset 0 0 0 4px #2d2929,inset 0 0 0 7px #c69a68,0 15px 45px #0009}
      #officeMeEntrance .ome-leaf:before{inset:9% 8%}}
    @media(prefers-reduced-motion:reduce){#officeMeEntrance *,#officeMeEntrance *:before,#officeMeEntrance *:after{animation:none!important;transition-duration:.01ms!important}}
  `;
  document.head.append(style);

  const overlay = document.createElement("section");
  overlay.id = "officeMeEntrance";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");
  overlay.setAttribute("aria-labelledby","omeTitle");
  overlay.innerHTML = `
    <div class="ome-content">
      <div class="ome-brand">OFFICEME × GLOBAL AFFILIATE AI</div>
      <h1 id="omeTitle">Your AI Workspace</h1>
      <p class="ome-sub">Satu pintu menuju pusat kendali dan ruang kerja tim AI Anda.</p>
      <div class="ome-stage" aria-hidden="true">
        <div class="ome-glow"></div>
        <div class="ome-room"><div class="ome-window"></div><div class="ome-workers">
          ${agents.map((a,i)=>'<div class="ome-worker" style="--delay:'+(-i*.19)+'s"><img src="./assets/'+a[2]+'" alt=""><i></i></div>').join("")}
        </div><div class="ome-monitor"></div><div class="ome-desk"></div><div class="ome-floor"></div></div>
        <div class="ome-door" role="button" tabindex="0" aria-label="Klik untuk membuka pintu ruang kerja"><div class="ome-leaf left"></div><div class="ome-leaf right"></div></div>
      </div>
      <button class="ome-enter" type="button">BUKA PINTU · MASUK KE RUANG KERJA <span aria-hidden="true">↗</span></button>
      <div class="ome-foot">8 AI SPECIALISTS · ONE CONNECTED WORKSPACE</div>
    </div>`;
  document.body.append(overlay);

  const enter = overlay.querySelector(".ome-enter");
  let opened = false;
  function openOffice() {
    if (opened) return;
    opened = true;
    enter.disabled = true;
    enter.textContent = "MEMBUKA RUANG KERJA…";
    overlay.classList.add("is-opening");
    window.setTimeout(() => overlay.classList.add("is-leaving"), 1120);
    window.setTimeout(() => {
      overlay.remove();
      style.remove();
      // Reveal the existing 3D workers room as the first view inside the unified workspace.
      const roomView = document.getElementById("roomView");
      const roomSection = roomView?.closest("section");
      if (roomSection) roomSection.classList.remove("office-simple-hidden");
      if (roomView) {
        roomView.hidden = false;
        roomView.style.setProperty("display","block","important");
        const roomHeading = roomSection?.querySelector("h2");
        if (roomHeading) roomHeading.textContent = "Ruang Kerja AI · Global Affiliate Engine";
        const roomDescription = document.getElementById("roomDescription");
        if (roomDescription) roomDescription.textContent = "Delapan spesialis AI berada di workstation masing-masing. Gerakan karakter adalah simulasi visual; status tugas berasal dari backend.";
        const title = document.getElementById("roomTitle");
        if (title) title.textContent = "AI Agent Workspace";
        const affiliatePanel = document.getElementById("affiliateWorkflowPanel");
        if (affiliatePanel && roomSection) roomSection.insertAdjacentElement("afterend", affiliatePanel);
        const linkManager = document.getElementById("affiliateLinkManager");
        if (linkManager && roomSection) (affiliatePanel || roomSection).insertAdjacentElement("afterend", linkManager);
        const openWorkersRoom = () => window.appdigiOpenVirtualRoom?.("workers");
        if (typeof window.appdigiOpenVirtualRoom === "function") openWorkersRoom();
        else window.addEventListener("appdigi:virtual-office-ready",openWorkersRoom,{once:true});
      }
      document.dispatchEvent(new CustomEvent("officeme:entrance-opened"));
    }, 2050);
  }
  enter.addEventListener("click",openOffice);
  const door = overlay.querySelector(".ome-door");
  door.addEventListener("click",openOffice);
  door.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openOffice();}});
  overlay.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !opened) openOffice();
  });
})();
