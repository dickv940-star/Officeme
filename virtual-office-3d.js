/* AppDIGI Virtual Office 3D — procedural fallback plus optional rigged GLB characters; original code under repository license.
 * No remote character meshes are downloaded. All geometry is generated in code.
 * Motion is a visual simulation only; it does not represent real AI execution.
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

(() => {
  const host = document.getElementById("virtualOffice3d");
  if (!host || host.dataset.initialized === "true") return;
  host.dataset.initialized = "true";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 650px)");
  const storageKey = "appdigi_officeme_workers_v1";
  let renderer, scene, camera, controls, raf = 0, lastTime = 0, elapsed = 0, active = false;
  let actors = [], roomObjects = [], resizeObserver, currentRoom = "workers", motionPaused = false, cctvEnabled = false, cctvDistance = 12, cctvTarget = "room";
  const activityStates = new Map();
  let statusHud = null, lastHudUpdate = 0;
  const status = document.getElementById("virtualOfficeStatus");
  const canvasWrap = host.querySelector(".vo3d-canvas-wrap");
  const modelManifestUrl = new URL("./assets/models/manifest.json", import.meta.url).href;
  const gltfLoader = new GLTFLoader();
  let modelManifestPromise = null;

  function characterModelKey(worker) {
    const name = String(worker?.name || "").toLowerCase().trim();
    const keys = {
      "alexander":"alexander-data-analyst", "olivia":"olivia-product-researcher",
      "ethan":"ethan-marketing-strategist", "sophia":"sophia-content-creator",
      "daniel":"daniel-seo-specialist", "isabella":"isabella-graphic-designer",
      "lucas":"lucas-automation-engineer", "charlotte":"charlotte-quality-controller",
      "william":"william-bigboss", "william bigboss":"william-bigboss"
    };
    return keys[name] || name.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function getModelManifest() {
    if (!modelManifestPromise) {
      modelManifestPromise = fetch(modelManifestUrl, { cache: "no-cache" })
        .then(response => {
          if (!response.ok) throw new Error("manifest model karakter tidak tersedia");
          return response.json();
        })
        .catch(error => {
          console.info("[Virtual Office 3D] Model GLB kustom belum dikonfigurasi; memakai karakter fallback.", error.message);
          return { version: 1, models: {} };
        });
    }
    return modelManifestPromise;
  }

  async function loadCustomCharacterModel(actor) {
    const worker = actor.userData.worker || {};
    const key = characterModelKey(worker);
    const manifest = await getModelManifest();
    const entry = manifest.models?.[key];
    if (!entry || typeof entry.file !== "string" || !entry.file.toLowerCase().endsWith(".glb")) return;
    const url = new URL(entry.file.replace(/^\/+/, ""), import.meta.url).href;
    gltfLoader.load(url, gltf => {
      const model = gltf.scene;
      model.position.set(Number(entry.x) || 0, Number(entry.y) || 0, Number(entry.z) || 0);
      model.rotation.y = Number(entry.rotationY) || 0;
      const scale = Number(entry.scale);
      model.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
      model.traverse(node => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
      });
      actor.add(model);
      actor.userData.customModel = model;
      if (actor.userData.rig) actor.userData.rig.visible = false;
      if (gltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(model);
        const requested = entry.animation ? gltf.animations.find(clip => clip.name === entry.animation) : null;
        mixer.clipAction(requested || gltf.animations[0]).play();
        actor.userData.modelMixer = mixer;
      }
      if (entry.labelHeight != null) {
        const label = actor.children.find(child => child.isSprite);
        if (label) label.position.y = Number(entry.labelHeight) || label.position.y;
      }
      console.info("[Virtual Office 3D] Model 3D kustom dimuat:", key);
    }, undefined, error => {
      console.warn("[Virtual Office 3D] Model GLB gagal dimuat; memakai karakter fallback:", key, error);
    });
  }

  const mat = (color, roughness = 0.78, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const materials = {
    wall: mat("#d8e3e9"), wallDark: mat("#9eb5c4"), floor: mat("#b9a18b"),
    wood: mat("#986a48"), woodLight: mat("#d1a47b"), metal: mat("#526b7c", .42, .55),
    screen: new THREE.MeshStandardMaterial({ color:"#163449", emissive:"#247b9b", emissiveIntensity:.65, roughness:.28 }),
    leaf: mat("#438568"), pot: mat("#b77756"), white: mat("#f2f5f4"), mug: mat("#e5c69e")
  };
  const colorSet = ["#527eaf","#b66c56","#638b76","#8a6ab2","#c28b45","#397f91","#a65c77","#667c91"];
  const skinSet = ["#d8a17d","#9b674d","#edc3a1","#c98d69","#8c5a43","#e0b18c","#ad7459","#f0c7a6"];
  const hairSet = ["#302a29","#4a3024","#332c38","#a17b4d","#26252a","#4d3830","#2e2425","#8b6748"];

  function addMesh(parent, geometry, material, pos, scale, name) {
    const mesh = new THREE.Mesh(geometry, material);
    if (pos) mesh.position.set(...pos);
    if (scale) mesh.scale.set(...scale);
    if (name) mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function box(parent, size, material, pos, name) {
    return addMesh(parent, new THREE.BoxGeometry(...size), material, pos, null, name);
  }
  function cylinder(parent, rt, rb, h, material, pos, seg = 16) {
    return addMesh(parent, new THREE.CylinderGeometry(rt, rb, h, seg), material, pos);
  }
  function sphere(parent, material, pos, scale) {
    return addMesh(parent, new THREE.SphereGeometry(1, 16, 12), material, pos, scale);
  }
  function capsulePart(parent, material, pos, scale) {
    return addMesh(parent, new THREE.CapsuleGeometry(.12, .34, 3, 8), material, pos, scale);
  }
  function makeLabel(name, role) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(10,20,34,.88)"; ctx.beginPath(); ctx.roundRect(5,5,502,118,20); ctx.fill();
    ctx.fillStyle = "#edf5ff"; ctx.font = "bold 38px system-ui"; ctx.fillText(String(name).slice(0,22), 24, 51);
    ctx.fillStyle = "#9ec5e4"; ctx.font = "25px system-ui"; ctx.fillText(String(role).slice(0,31), 24, 91);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false }));
    sprite.scale.set(1.8,.45,1); sprite.position.y = 2.48;
    return sprite;
  }
  function makeLimb(parent, material, x, y, z, upper = .35, lower = .32) {
    const pivot = new THREE.Group(); pivot.position.set(x,y,z); parent.add(pivot);
    capsulePart(pivot, material, [0,-upper*.48,0], [.78,upper*1.1,.78]);
    const elbow = new THREE.Group(); elbow.position.y = -upper*.92; pivot.add(elbow);
    capsulePart(elbow, material, [0,-lower*.48,0], [.68,lower*1.08,.68]);
    sphere(elbow, material, [0,-lower,0], [.09,.09,.09]);
    return {pivot, elbow};
  }
  function makeActor(worker, index) {
    const root = new THREE.Group(); root.userData.worker = worker;
    // Visual profiles are based on the existing transparent PNG references, not random index colors.
    const characterId = String(worker?.name || "").toLowerCase().trim();
    const profiles = {
      "alexander": {shirt:"#292c32",skin:"#e3b29a",hair:"#201d20",trousers:"#303137",shoe:"#e7e5df",hairStyle:"short",jacket:true,tie:"#243b60",sneakers:true},
      "olivia": {shirt:"#f2f2ed",skin:"#e8b69e",hair:"#211d20",trousers:"#202b43",shoe:"#22242a",hairStyle:"long",tablet:true},
      "ethan": {shirt:"#c9dff1",skin:"#efc6ad",hair:"#9993a4",trousers:"#292a2e",shoe:"#25262a",hairStyle:"short",glasses:true},
      "sophia": {shirt:"#e6d7c7",skin:"#e7b59c",hair:"#211d20",trousers:"#242326",shoe:"#28252a",hairStyle:"shoulder",jacket:true},
      "daniel": {shirt:"#202124",skin:"#d8a17f",hair:"#201d1d",trousers:"#343239",shoe:"#202126",hairStyle:"short",shortSleeves:true},
      "isabella": {shirt:"#30343b",skin:"#e8b69b",hair:"#211d20",trousers:"#30343b",shoe:"#202126",hairStyle:"long",jacket:true},
      "lucas": {shirt:"#e9f0f4",skin:"#dca681",hair:"#201c1d",trousers:"#3b4148",shoe:"#25282b",hairStyle:"short",tablet:true},
      "charlotte": {shirt:"#202022",skin:"#e8b69b",hair:"#211c1e",trousers:"#202022",shoe:"#202126",hairStyle:"long",skirt:true,lipstick:"#a84245"},
      "william bigboss": {shirt:"#25262a",skin:"#dfae92",hair:"#211e1f",trousers:"#25262a",shoe:"#17181b",hairStyle:"short",jacket:true,tie:"#17191c"}
    };
    const profile = profiles[characterId] || {shirt:colorSet[index % colorSet.length],skin:skinSet[index % skinSet.length],hair:hairSet[index % hairSet.length],trousers:index%2 ? "#34465b" : "#3d4c60",shoe:"#263342",hairStyle:"short"};
    const shirt = mat(profile.shirt), skin = mat(profile.skin);
    const hair = mat(profile.hair), trousers = mat(profile.trousers);
    const shoe = mat(profile.shoe), face = skin;
    // articulated hierarchy: torso, head, shoulders, elbows, hips, knees and feet
    const rig = new THREE.Group(); root.add(rig);
    const hips = new THREE.Group(); hips.position.y = .91; rig.add(hips);
    box(hips,[.42,.25,.25],trousers,[0,0,0],"pelvis");
    const torso = new THREE.Group(); torso.position.y = .12; hips.add(torso);
    capsulePart(torso,shirt,[0,.28,0],[1.65,1.48,.95]);
    sphere(torso,shirt,[0,.64,0],[.23,.15,.17]);
    if(profile.jacket){
      const shirtFront=mat("#f1f0eb");
      box(torso,[.16,.45,.035],shirtFront,[0,.40,.125]);
      const lapelL=box(torso,[.075,.35,.035],shirt,[-.095,.43,.15]);lapelL.rotation.z=-.19;
      const lapelR=box(torso,[.075,.35,.035],shirt,[.095,.43,.15]);lapelR.rotation.z=.19;
      if(profile.tie){
        box(torso,[.038,.23,.025],mat(profile.tie),[0,.40,.17]);
        addMesh(torso,new THREE.ConeGeometry(.035,.075,4),mat(profile.tie),[0,.265,.17]);
      }
    }
    const neck = cylinder(torso,.075,.085,.15,skin,[0,.78,0],12);
    const head = new THREE.Group(); head.position.set(0,.93,0); torso.add(head);
    sphere(head,face,[0,.05,.015],[.22,.27,.205]);
    sphere(head,hair,[0,.22,-.015],[.23,.14,.21]);
    sphere(head,hair,[-.18,.08,0],[.065,.18,.17]);
    sphere(head,hair,[.18,.08,0],[.065,.18,.17]);
    if(profile.hairStyle==="long"||profile.hairStyle==="shoulder"){
      sphere(head,hair,[0,-.12,-.105],[.235,.28,.14]);
      const length=profile.hairStyle==="long"?1.05:.76;
      capsulePart(head,hair,[-.185,-.18,-.035],[.64,length,.62]);
      capsulePart(head,hair,[.185,-.18,-.035],[.64,length,.62]);
      sphere(head,hair,[-.17,-.46,-.025],[.075,.09,.075]);
      sphere(head,hair,[.17,-.46,-.025],[.075,.09,.075]);
    }
    // tiny eyes face the front (+Z)
    const eyeMat = mat("#292d33", .38);
    const eyeL = sphere(head,eyeMat,[-.075,.075,.199],[.022,.022,.012]);
    const eyeR = sphere(head,eyeMat,[.075,.075,.199],[.022,.022,.012]);
    // Face and clothing details add readable volume without using a flat character image.
    sphere(head,skin,[-.222,.025,.015],[.035,.07,.045]);
    sphere(head,skin,[.222,.025,.015],[.035,.07,.045]);
    sphere(head,skin,[0,.015,.208],[.032,.047,.035]); // nose
    const mouth = sphere(head,mat(profile.lipstick||"#8c514b"),[0,-.075,.195],[.047,.009,.009]);
    const browMat = mat(profile.hair||hairSet[index % hairSet.length], .88);
    if(profile.glasses){
      const glassesMat=mat("#333b45",.35,.25);
      addMesh(head,new THREE.TorusGeometry(.055,.007,6,16),glassesMat,[-.075,.075,.214]);
      addMesh(head,new THREE.TorusGeometry(.055,.007,6,16),glassesMat,[.075,.075,.214]);
      box(head,[.045,.009,.009],glassesMat,[0,.075,.214]);
    }
    sphere(head,browMat,[-.075,.119,.193],[.046,.012,.012]);
    sphere(head,browMat,[.075,.119,.193],[.046,.012,.012]);
    // Neckline, jacket seams and buttons are separate 3D geometry.
    cylinder(torso,.105,.105,.035,mat("#f3f2ec"),[0,.735,.015],12);
    for(let b=0;b<3;b++) sphere(torso,mat("#e6e0d3"),[.015,.43-b*.105,.115],[.012,.012,.009]);
    const shoulders = new THREE.Group(); shoulders.position.set(0,.53,0); torso.add(shoulders);
    const armL = makeLimb(shoulders,shirt,-.28,0,0,.34,.3);
    const armR = makeLimb(shoulders,shirt,.28,0,0,.34,.3);
    // Visible palms and individual fingers make typing poses less like rigid sticks.
    const makeHand = limb => {
      const hand = sphere(limb.elbow,skin,[0,-.315,.055],[.095,.105,.065]);
      const fingers = [];
      for (let f=0; f<4; f++) {
        const finger = capsulePart(limb.elbow,skin,[-.057+f*.038,-.385,.105],[.22,.23,.22]);
        finger.rotation.z=(f-1.5)*-.08;
        fingers.push(finger);
      }
      const thumb = capsulePart(limb.elbow,skin,[.085,-.325,.105],[.2,.22,.2]);
      thumb.rotation.z=.55;
      return {hand,fingers,thumb};
    };
    const handL = makeHand(armL), handR = makeHand(armR);
    if(profile.skirt) cylinder(hips,.25,.31,.42,trousers,[0,-.18,0],20);
    const legL = makeLimb(hips,trousers,-.13,-.1,0,.36,.34);
    const legR = makeLimb(hips,trousers,.13,-.1,0,.36,.34);
    const footL = box(legL.elbow,[.16,.09,.28],shoe,[0,-.34,.07],"shoe");
    const footR = box(legR.elbow,[.16,.09,.28],shoe,[0,-.34,.07],"shoe");
    const label = makeLabel(worker.name || "Pekerja", worker.role || worker.department || "Tim AppDIGI");
    root.add(label);
    // understated workstation for each worker
    const desk = new THREE.Group(); root.add(desk); desk.position.set(0,.72,.43);
    box(desk,[.92,.09,.54],materials.woodLight,[0,0,0],"desk-top");
    box(desk,[.07,.7,.07],materials.metal,[-.37,-.38,0]); box(desk,[.07,.7,.07],materials.metal,[.37,-.38,0]);
    if(profile.tablet){
      const tablet=new THREE.Group();desk.add(tablet);tablet.position.set(-.27,.075,.04);tablet.rotation.x=-.12;tablet.rotation.y=-.18;
      box(tablet,[.22,.29,.025],materials.metal,[0,.02,0]);
      box(tablet,[.19,.25,.008],materials.screen,[0,.02,.017]);
      box(tablet,[.13,.008,.006],mat("#7ed5d2"),[0,.07,.022]);
    }
    const laptop = new THREE.Group(); desk.add(laptop); laptop.position.set(0,.06,-.08);
    box(laptop,[.38,.025,.27],materials.metal,[0,0,0]);
    // Keyboard rows and trackpad give the workstation a tangible, readable silhouette.
    const keyMat = mat("#8ea0ad", .58);
    for(let row=0;row<3;row++) for(let col=0;col<9;col++)
      box(laptop,[.025,.004,.018],keyMat,[-.145+col*.036,.015,.075-row*.027]);
    box(laptop,[.09,.003,.045],mat("#b7c3cc",.5),[0,.016,-.005]);
    const screen = box(laptop,[.34,.235,.025],materials.screen,[0,.13,-.115]); screen.rotation.x=-.12;
    const screenGlow = box(laptop,[.29,.19,.004],mat("#286d86",.34,.1),[0,.132,-.131]); screenGlow.rotation.x=-.12;
    for(let line=0;line<4;line++) box(laptop,[.17-(line%2)*.045,.005,.004],mat("#6bd0cb",.35),[-.015,.17-line*.035,-.134]);
    // Cuff bands visually separate forearms from the shirt sleeves.
    const cuffL = cylinder(shoulders,.078,.078,.055,mat("#dfe5e9"),[-.28,-.29,0],10);
    cuffL.rotation.z=Math.PI/2;
    const cuffR = cylinder(shoulders,.078,.078,.055,mat("#dfe5e9"),[.28,-.29,0],10);
    cuffR.rotation.z=Math.PI/2;
    root.userData.face = {eyeL,eyeR,mouth};
    root.userData.hands = {handL,handR};
    root.userData.rig = {hips,torso,head,shoulders,armL,armR,legL,legR,desk,laptop,footL,footR};
    root.userData.base = {position:new THREE.Vector3(), rotation:0};
    root.userData.mode = index % 5 === 0 ? "stand" : index % 4 === 0 ? "walk" : "type";
    root.userData.phase = index * 1.7;
    return root;
  }

  function clearRoom() {
    actors.forEach(a => { scene.remove(a); a.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material){const list=Array.isArray(o.material)?o.material:[o.material];list.forEach(material=>{if(material.map)material.map.dispose();material.dispose();});} }); });
    actors=[]; roomObjects.forEach(o=>{scene.remove(o);o.traverse?.(child=>{if(child.geometry)child.geometry.dispose();});if(o.geometry)o.geometry.dispose();}); roomObjects=[];
  }
  function addRoomObject(o){scene.add(o);roomObjects.push(o);return o;}
  function makePlant(x,z) {
    const g = new THREE.Group(); g.position.set(x,0,z);
    cylinder(g,.2,.25,.35,materials.pot,[0,.18,0]);
    for(let i=0;i<6;i++){const leaf=sphere(g,materials.leaf,[Math.cos(i)*.18,.55+(i%3)*.07,Math.sin(i)*.18],[.12,.35,.09]);leaf.rotation.z=Math.cos(i)*.45;leaf.rotation.x=Math.sin(i)*.4;}
    return addRoomObject(g);
  }
  function makeChair(x,z,rot=0) {
    const g = new THREE.Group(); g.position.set(x,0,z);g.rotation.y=rot;
    box(g,[.46,.08,.44],materials.metal,[0,.48,0]);
    box(g,[.45,.55,.07],materials.metal,[0,.78,-.19]);
    for(const dx of [-.17,.17])for(const dz of [-.15,.15])cylinder(g,.025,.025,.47,materials.metal,[dx,.23,dz],8);
    return addRoomObject(g);
  }
  function buildRoom(roomId, workers, invite = null) {
    clearRoom();
    const floor = addRoomObject(new THREE.Mesh(new THREE.PlaneGeometry(14,10),materials.floor));
    floor.rotation.x=-Math.PI/2; floor.position.y=-.04; floor.receiveShadow=true;
    const back = box(scene,[14,3.6,.18],materials.wall,[0,1.8,-5]);
    const left = box(scene,[.18,3.6,10],materials.wallDark,[-7,1.8,0]);
    roomObjects.push(back,left);
    // windows, trim, and warm overhead lights
    for(let i=0;i<4;i++){
      const win=box(scene,[2.1,1.15,.045],new THREE.MeshStandardMaterial({color:"#8ed4e7",emissive:"#367a96",emissiveIntensity:.22,roughness:.25}),[-4.7+i*2.7,2.35,-4.88]);
      roomObjects.push(win);
      const frame=box(scene,[2.2,.07,.07],materials.white,[-4.7+i*2.7,2.96,-4.84]);roomObjects.push(frame);
    }
    makePlant(-5.9, -3.8); makePlant(5.9,-3.8);
    const deskMat=materials.wood;
    if(roomId==="workers"){
      // shared collaboration table plus individual workstations
      cylinder(scene,1.5,1.6,.16,deskMat,[0,.83,0],48).receiveShadow=true;
      const tableTop=scene.children[scene.children.length-1];roomObjects.push(tableTop);
      cylinder(scene,.35,.48,.76,materials.metal,[0,.39,0],24);roomObjects.push(scene.children[scene.children.length-1]);
      for(let i=0;i<Math.min(workers.length,8);i++){
        const angle=(-Math.PI/2)+(i*2*Math.PI/Math.max(workers.length,1));
        const x=Math.cos(angle)*3.05,z=Math.sin(angle)*2.55;
        const actor=makeActor(workers[i],i);actor.position.set(x,0,z);actor.rotation.y=-angle-Math.PI/2;actor.userData.mode="sit";
        actor.userData.base.position.set(x,0,z);actor.userData.base.rotation=actor.rotation.y;
        scene.add(actor);actors.push(actor);loadCustomCharacterModel(actor);makeChair(x+Math.cos(angle)*.35,z+Math.sin(angle)*.35,actor.rotation.y);
      }
    } else if(roomId==="cafe"){
      box(scene,[3.8,.16,1.2],materials.woodLight,[1,.8,-1.6]);roomObjects.push(scene.children[scene.children.length-1]);
      for(let i=0;i<2;i++){cylinder(scene,.42,.42,.12,materials.wood,[i*1.5,.92,-1.5],24);roomObjects.push(scene.children[scene.children.length-1]);}
      box(scene,[4,.65,.35],materials.wood,[3,.4,-3.8]);roomObjects.push(scene.children[scene.children.length-1]);
      workers.slice(0,2).forEach((w,i)=>{const a=makeActor(w,i);a.position.set(i?2:0,0,.3);a.userData.mode="sit";scene.add(a);actors.push(a);loadCustomCharacterModel(a);makeChair(i?2:0,.6,Math.PI);});
    } else {
      box(scene,[3.4,.15,1.1],materials.woodLight,[0,.82,-1.8]);roomObjects.push(scene.children[scene.children.length-1]);
      box(scene,[.65,.6,.08],materials.screen,[0,1.2,-2]);roomObjects.push(scene.children[scene.children.length-1]);
      const director={name:"William Bigboss",role:"Director"};
      const a=makeActor(director,8);a.position.set(invite&&invite.name?-.82:0,0,.15);a.rotation.y=invite&&invite.name?-.18:0;a.userData.mode="sit";a.userData.base.position.copy(a.position);a.userData.base.rotation=a.rotation.y;scene.add(a);actors.push(a);loadCustomCharacterModel(a);makeChair(a.position.x,.7,Math.PI);
      if(invite&&typeof invite.name==="string"&&invite.name.trim()){
        const guest={name:invite.name.trim().slice(0,60),role:String(invite.role||"Spesialis AppDIGI").slice(0,100)};
        const guestIndex=Math.max(0,workers.findIndex(w=>String(w.name).toLowerCase()===guest.name.toLowerCase()));
        const guestActor=makeActor(guest,guestIndex);
        // The invited agent visibly enters the director room and walks to the meeting chair.
        guestActor.position.set(5.7,0,3.65);guestActor.rotation.y=-Math.PI/2;guestActor.userData.mode="walk";
        guestActor.userData.base.position.copy(guestActor.position);guestActor.userData.base.rotation=guestActor.rotation.y;
        guestActor.userData.walkTarget=new THREE.Vector3(1.28,0,.25);guestActor.userData.destinationMode="sit";
        scene.add(guestActor);actors.push(guestActor);loadCustomCharacterModel(guestActor);makeChair(1.58,.7,.2);
      }
    }
    // ceiling lights represented by emissive pendants
    for(const x of [-3,0,3]){cylinder(scene,.09,.09,.22,materials.metal,[x,3.3,-.8],12);roomObjects.push(scene.children[scene.children.length-1]);sphere(scene,mat("#ffe4a2",.4),[x,3.12,-.8],[.18,.07,.18]);roomObjects.push(scene.children[scene.children.length-1]);}
  }
  function loadWorkers() {
    try { const data=JSON.parse(localStorage.getItem(storageKey)||"null"); if(Array.isArray(data)&&data.length)return data; } catch(_) {}
    return [
      {name:"Alexander",role:"Data Analyst"},{name:"Olivia",role:"Product Researcher"},
      {name:"Ethan",role:"Marketing Strategist"},{name:"Sophia",role:"Content Creator"},
      {name:"Daniel",role:"SEO Specialist"},{name:"Isabella",role:"Graphic Designer"},
      {name:"Lucas",role:"Automation Engineer"},{name:"Charlotte",role:"Quality Controller"}
    ];
  }
  function setStatus(text){if(status)status.textContent=text;}
  function ensureStatusHud(){
    if(statusHud||!host)return;
    host.style.position="relative";
    statusHud=document.createElement("section");statusHud.setAttribute("aria-label","Status pekerja AI");
    Object.assign(statusHud.style,{position:"absolute",left:"12px",top:"76px",zIndex:"4",width:"min(245px,calc(100% - 24px))",maxHeight:"min(48%,320px)",overflowY:"auto",padding:"10px 12px",borderRadius:"12px",background:"rgba(15,28,42,.88)",color:"#f3f7fb",font:"12px/1.45 system-ui,sans-serif",boxShadow:"0 8px 24px rgba(0,0,0,.22)",backdropFilter:"blur(8px)",pointerEvents:"none"});
    const heading=document.createElement("div");heading.textContent="TIM AI · STATUS LANGSUNG";Object.assign(heading.style,{fontWeight:"800",fontSize:"10px",letterSpacing:"1px",marginBottom:"7px",color:"#8fe1dc"});
    const list=document.createElement("div");list.dataset.statusList="true";statusHud.append(heading,list);host.append(statusHud);renderStatusHud();
  }
  function renderStatusHud(){
    if(!statusHud)return;const list=statusHud.querySelector("[data-status-list]");if(!list)return;list.replaceChildren();
    const roster=[{name:"William Bigboss",role:"Direktur"},...loadWorkers()];
    roster.forEach(person=>{
      const key=String(person.name||"").toLowerCase();
      const actor=actors.find(a=>String(a.userData.worker?.name||"").toLowerCase()===key);
      let state=activityStates.get(key)||"idle";
      if(actor?.userData.walkTarget)state="walking";
      else if(actor?.userData.conversationMode==="thinking")state="thinking";
      else if(actor?.userData.conversationMode==="speaking")state="speaking";
      else if(actor?.userData.mode==="type")state="working";
      else if(actor?.userData.mode==="sit"&&!activityStates.has(key))state="at desk";
      const labels={idle:"Siaga",walking:"Berjalan",thinking:"Berpikir",speaking:"Berbicara",working:"Bekerja",type:"Bekerja",sit:"Duduk",stand:"Berdiri","at desk":"Di tempat kerja"};
      const row=document.createElement("div");Object.assign(row.style,{display:"flex",justifyContent:"space-between",gap:"8px",padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,.08)"});
      const name=document.createElement("span");name.textContent=person.name;name.style.fontWeight="600";
      const statusText=document.createElement("span");statusText.textContent=labels[state]||state;statusText.style.color=state==="walking"?"#ffd58a":state==="thinking"?"#b8c7ff":state==="speaking"?"#8fe1dc":"#d3dfeb";
      row.append(name,statusText);list.append(row);
    });
  }
  function animateActor(actor, time) {
    const r=actor.userData.rig, t=time+actor.userData.phase, mode=actor.userData.mode;
    if(motionPaused){r.torso.rotation.z=0;r.head.rotation.y=0;r.legL.pivot.rotation.x=0;r.legR.pivot.rotation.x=0;r.armL.pivot.rotation.x=mode==="type"?-1:0;r.armR.pivot.rotation.x=mode==="type"?-1:0;return;}
    const sway = reducedMotion.matches ? 0 : Math.sin(t*1.35)*.022;
    r.torso.rotation.z=sway;
    r.torso.rotation.x=reducedMotion.matches ? 0 : Math.sin(t*.9)*.012;
    r.head.rotation.y=reducedMotion.matches?0:Math.sin(t*.63)*.075;
    r.head.rotation.x=reducedMotion.matches ? -.035 : -.035+Math.sin(t*.72)*.018;
    // Subtle blinking is time-based, with no timer allocations per actor.
    const blink = reducedMotion.matches ? 1 : Math.max(.12,1-Math.pow(Math.max(0,Math.cos(t*1.9+actor.userData.phase)),36)*.9);
    if(actor.userData.face){actor.userData.face.eyeL.scale.y=.022*blink;actor.userData.face.eyeR.scale.y=.022*blink;}
    if(mode==="walk" && !reducedMotion.matches) {
      const walk=t*2.3;
      r.legL.pivot.rotation.x=Math.sin(walk)*.5;r.legR.pivot.rotation.x=-Math.sin(walk)*.5;
      r.armL.pivot.rotation.x=-Math.sin(walk)*.3;r.armR.pivot.rotation.x=Math.sin(walk)*.3;
      r.hips.position.y=.91+Math.abs(Math.sin(walk))*.035;
      r.desk.visible=false;
    } else if(mode==="stand") {
      r.hips.position.y=.91;r.legL.pivot.rotation.x=0;r.legR.pivot.rotation.x=0;
      r.armL.pivot.rotation.x=reducedMotion.matches?-.15:-.15+Math.sin(t)*.1;
      r.armR.pivot.rotation.x=.12;
      r.desk.visible=false;
    } else if(mode==="sit") {
      r.hips.position.y=.66;r.legL.pivot.rotation.x=-1.15;r.legR.pivot.rotation.x=-1.15;
      r.armL.pivot.rotation.x=-1.05+(reducedMotion.matches?0:Math.sin(t*3.8)*.035);r.armR.pivot.rotation.x=-1.05+(reducedMotion.matches?0:Math.cos(t*4.1)*.035);
      r.armL.elbow.rotation.x=-.28+(reducedMotion.matches?0:Math.sin(t*3.1)*.055);r.armR.elbow.rotation.x=-.28+(reducedMotion.matches?0:Math.cos(t*3.35)*.055);
      r.armL.elbow.rotation.z=reducedMotion.matches?0:Math.sin(t*2.2)*.025;
      r.armR.elbow.rotation.z=reducedMotion.matches?0:Math.cos(t*2.45)*.025;
      // Tiny alternating finger and wrist motions suggest active typing, not a mechanical loop.
      if(actor.userData.hands){
        actor.userData.hands.handL.fingers.forEach((finger,i)=>{finger.rotation.x=reducedMotion.matches?0:Math.sin(t*7+i*.8)*.12;});
        actor.userData.hands.handR.fingers.forEach((finger,i)=>{finger.rotation.x=reducedMotion.matches?0:Math.cos(t*7.4+i*.75)*.12;});
        actor.userData.hands.handL.thumb.rotation.x=reducedMotion.matches?0:Math.sin(t*5.4)*.08;
        actor.userData.hands.handR.thumb.rotation.x=reducedMotion.matches?0:Math.cos(t*5.7)*.08;
      }
      if(actor.userData.conversationMode==="speaking"){
        r.head.rotation.x=reducedMotion.matches?-.025:-.025+Math.sin(t*3.2)*.035;
        r.head.rotation.y=reducedMotion.matches?0:Math.sin(t*2.1)*.09;
        r.armL.pivot.rotation.x=-.82+(reducedMotion.matches?0:Math.sin(t*3.4)*.12);
        r.armR.pivot.rotation.x=-.72+(reducedMotion.matches?0:Math.cos(t*3.1)*.12);
        r.armL.elbow.rotation.x=-.38+(reducedMotion.matches?0:Math.sin(t*3.8)*.1);
        r.armR.elbow.rotation.x=-.32+(reducedMotion.matches?0:Math.cos(t*3.6)*.1);
      } else if(actor.userData.conversationMode==="thinking"){
        r.head.rotation.x=reducedMotion.matches?-.08:-.08+Math.sin(t*.8)*.025;
        r.head.rotation.y=reducedMotion.matches?0:-.12+Math.sin(t*.55)*.035;
      } else {
        r.head.rotation.x=reducedMotion.matches?-.04:-.04+Math.sin(t*.85)*.018;
      }
      r.desk.visible=true;
    } else {
      r.hips.position.y=.91;r.legL.pivot.rotation.x=0;r.legR.pivot.rotation.x=0;
      r.armL.pivot.rotation.x=-1.0+(reducedMotion.matches?0:Math.sin(t*5)*.08);
      r.armR.pivot.rotation.x=-1.0+(reducedMotion.matches?0:Math.cos(t*5)*.08);
      r.armL.elbow.rotation.x=-.25;r.armR.elbow.rotation.x=-.25;
      r.desk.visible=true;
    }
    if(mode==="walk" && !reducedMotion.matches) actor.rotation.y=actor.userData.base.rotation+Math.sin(t*.45)*.35;
  }
  function frame(now) {
    raf=requestAnimationFrame(frame);
    if(!active||!renderer||!scene)return;
    const dt=Math.min((now-lastTime)/1000||0,.05);lastTime=now;
    if(!reducedMotion.matches) elapsed+=dt;
    actors.forEach(a=>{
      if(a.userData.walkTarget&&!motionPaused&&!reducedMotion.matches){
        const target=a.userData.walkTarget,dx=target.x-a.position.x,dz=target.z-a.position.z,dist=Math.hypot(dx,dz);
        if(dist<.13){a.position.x=target.x;a.position.z=target.z;a.userData.walkTarget=null;a.userData.mode=a.userData.destinationMode||"sit";a.userData.base.position.copy(a.position);a.userData.base.rotation=a.rotation.y;activityStates.set(String(a.userData.worker?.name||"").toLowerCase(),a.userData.mode);}
        else {const step=Math.min(dist,1.35*dt);a.position.x+=dx/dist*step;a.position.z+=dz/dist*step;a.rotation.y=Math.atan2(dx,dz);}
      }
      animateActor(a,elapsed);
      if(a.userData.modelMixer)a.userData.modelMixer.update(dt);
    });
    if(statusHud&&now-lastHudUpdate>450){renderStatusHud();lastHudUpdate=now;}
    controls.update();renderer.render(scene,camera);
  }
  function init() {
    if(renderer)return;
    scene=new THREE.Scene();scene.background=new THREE.Color("#c8dbe4");scene.fog=new THREE.Fog("#c8dbe4",13,28);
    camera=new THREE.PerspectiveCamera(42,1,.1,80);camera.position.set(9,9,12);
    ensureStatusHud();
    renderer=new THREE.WebGLRenderer({antialias:!mobile.matches,alpha:false,powerPreference:"low-power"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile.matches?1.25:1.7));
    renderer.shadowMap.enabled=!mobile.matches;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    canvasWrap.replaceChildren(renderer.domElement);renderer.domElement.setAttribute("aria-label","Visualisasi kantor 3D. Seret untuk memutar, roda mouse atau pinch untuk zoom, klik kanan atau dua jari untuk menggeser.");
    controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=!reducedMotion.matches;controls.dampingFactor=.07;controls.minDistance=5;controls.maxDistance=23;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.18;controls.update();
    scene.add(new THREE.HemisphereLight("#eff8ff","#5e6c7b",2.0));
    const key=new THREE.DirectionalLight("#fff0d9",3.0);key.position.set(-5,10,6);key.castShadow=true;key.shadow.mapSize.set(mobile.matches?512:1024,mobile.matches?512:1024);scene.add(key);
    const fill=new THREE.DirectionalLight("#a6dfff",1.0);fill.position.set(5,6,-4);scene.add(fill);
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvasWrap);resize();
    document.getElementById("vo3dReset")?.addEventListener("click",resetCamera);
    document.getElementById("vo3dMotion")?.addEventListener("click",toggleMotion);
    document.getElementById("vo3dCctvToggle")?.addEventListener("click",toggleCctv);
    document.getElementById("vo3dCctvFocus")?.addEventListener("click",()=>focusCctvTarget(document.getElementById("vo3dCctvTarget")?.value||"room"));
    document.getElementById("vo3dCctvTarget")?.addEventListener("change",e=>{cctvTarget=e.target.value;focusCctvTarget(cctvTarget);});
    document.getElementById("vo3dCctvZoom")?.addEventListener("input",e=>{
      cctvDistance=Number(e.target.value)||12;
      const output=document.getElementById("vo3dCctvZoomValue");if(output)output.textContent=cctvDistance.toFixed(cctvDistance%1?1:0)+"×";
      applyCctvZoom();
    });
    attachActorFocus();
    reducedMotion.addEventListener?.("change",()=>{if(controls)controls.enableDamping=!reducedMotion.matches;});
    setStatus("Simulasi visual aktif · gerakan karakter bukan aktivitas AI nyata.");
  }
  function resize() {
    if(!renderer||!canvasWrap)return;
    const w=Math.max(1,canvasWrap.clientWidth),h=Math.max(260,canvasWrap.clientHeight);
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
  }
  function resetCamera(){
    if(!camera||!controls)return;
    camera.position.set(9,9,12);controls.target.set(0,1,0);controls.update();
    cctvTarget="room";
    const selector=document.getElementById("vo3dCctvTarget");if(selector)selector.value="room";
    const zoom=document.getElementById("vo3dCctvZoom");if(zoom)zoom.value="12";
    cctvDistance=12;const output=document.getElementById("vo3dCctvZoomValue");if(output)output.textContent="12×";
  }
  function toggleCctv(){
    cctvEnabled=!cctvEnabled;
    const panel=document.getElementById("vo3dCctvPanel"),button=document.getElementById("vo3dCctvToggle");
    if(panel)panel.hidden=!cctvEnabled;
    if(button){button.setAttribute("aria-expanded",String(cctvEnabled));button.setAttribute("aria-pressed",String(cctvEnabled));button.textContent=cctvEnabled?"◉ CCTV Sensor Aktif":"◉ CCTV Sensor";}
    if(cctvEnabled){populateCctvTargets();focusCctvTarget(cctvTarget);setStatus("Kamera virtual aktif · pilih ruangan/aktivitas atau klik karakter untuk fokus. Ini bukan CCTV sungguhan.");}
    else setStatus("Kamera virtual ditutup · kontrol kamera 3D biasa tetap tersedia.");
  }
  function populateCctvTargets(){
    const select=document.getElementById("vo3dCctvTarget");if(!select)return;
    const current=cctvTarget||select.value||"room";
    const workerOptions=actors.map((actor,i)=>({value:"actor:"+i,label:"Pekerja: "+String(actor.userData.worker?.name||("Pekerja "+(i+1)))+" — "+String(actor.userData.worker?.role||actor.userData.worker?.department||"Tim")}));
    select.replaceChildren();
    const options=[
      {value:"room",label:"Ikhtisar ruangan"},
      {value:"room:workers",label:"Fokus ruang kolaborasi"},
      {value:"room:director",label:"Fokus meja direktur"},
      {value:"room:cafe",label:"Fokus area café"},
      {value:"activity:type",label:"Aktivitas simulasi: mengetik"},
      {value:"activity:walk",label:"Aktivitas simulasi: berjalan"},
      {value:"activity:stand",label:"Aktivitas simulasi: berdiri"},
      {value:"activity:sit",label:"Aktivitas simulasi: duduk"},
      ...workerOptions
    ];
    options.forEach(item=>{const option=document.createElement("option");option.value=item.value;option.textContent=item.label;select.append(option);});
    select.value=options.some(o=>o.value===current)?current:"room";
    cctvTarget=select.value;
  }
  function focusCctvTarget(target){
    if(!camera||!controls)return;
    cctvTarget=target||"room";
    const select=document.getElementById("vo3dCctvTarget");if(select&&select.value!==cctvTarget)select.value=cctvTarget;
    if(cctvTarget.startsWith("room:")){
      const destination=cctvTarget.split(":")[1];
      if(["workers","director","cafe"].includes(destination)&&destination!==currentRoom){
        window.dispatchEvent(new CustomEvent("appdigi:cctv-room-select",{detail:{id:destination}}));
        return;
      }
    }
    let point=new THREE.Vector3(0,1,0),actor=null,description="ikhtisar ruangan";
    if(cctvTarget.startsWith("actor:")){
      actor=actors[Number(cctvTarget.split(":")[1])];
      if(actor){point.copy(actor.position).add(new THREE.Vector3(0,1.25,0));description="pekerja "+(actor.userData.worker?.name||"terpilih");}
    }else if(cctvTarget.startsWith("activity:")){
      const mode=cctvTarget.split(":")[1];actor=actors.find(a=>a.userData.mode===mode);
      if(actor){point.copy(actor.position).add(new THREE.Vector3(0,1.2,0));description="aktivitas simulasi "+({type:"mengetik",walk:"berjalan",stand:"berdiri",sit:"duduk"}[mode]||mode);}
      else {setStatus("Belum ada karakter dengan pose simulasi tersebut di ruangan ini. Pilih pekerja atau ruangan lain.");return;}
    }else if(cctvTarget.startsWith("room:")){
      const room=cctvTarget.split(":")[1];
      point.set(room==="cafe"?1:0,1,room==="director"?-1.5:room==="cafe"?-1.6:0);
      description=room==="cafe"?"area café":room==="director"?"meja direktur":"ruang kolaborasi";
    }
    controls.target.copy(point);
    const direction=new THREE.Vector3().subVectors(camera.position,controls.target);
    if(direction.lengthSq()<.01)direction.set(4,2,6);
    direction.normalize();
    camera.position.copy(point).add(direction.multiplyScalar(cctvDistance));
    controls.update();
    setStatus("Kamera virtual diarahkan ke "+description+". Gunakan slider Zoom untuk mengatur jarak; seret layar untuk mengubah sudut.");
  }
  function applyCctvZoom(){
    if(!camera||!controls)return;
    const direction=new THREE.Vector3().subVectors(camera.position,controls.target);
    if(direction.lengthSq()<.01)direction.set(4,2,6);
    direction.normalize();camera.position.copy(controls.target).add(direction.multiplyScalar(cctvDistance));controls.update();
  }
  function attachActorFocus(){
    if(!renderer)return;
    const canvas=renderer.domElement,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let start=null;
    canvas.addEventListener("pointerdown",e=>{start={x:e.clientX,y:e.clientY,id:e.pointerId};});
    canvas.addEventListener("pointerup",e=>{
      if(!start||start.id!==e.pointerId)return;
      const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;
      if(moved>6)return;
      const rect=canvas.getBoundingClientRect();
      pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointer,camera);
      const roots=raycaster.intersectObjects(actors,true);
      if(!roots.length)return;
      let obj=roots[0].object;while(obj&& !obj.userData.rig)obj=obj.parent;
      if(!obj)return;
      const index=actors.indexOf(obj);if(index<0)return;
      cctvTarget="actor:"+index;
      if(cctvEnabled){populateCctvTargets();const select=document.getElementById("vo3dCctvTarget");if(select)select.value=cctvTarget;}
      focusCctvTarget(cctvTarget);
    });
  }
  function toggleMotion(){
    motionPaused=!motionPaused;
    const button=document.getElementById("vo3dMotion");
    if(button)button.textContent=motionPaused?"Lanjutkan gerakan":"Jeda gerakan";
    setStatus(motionPaused?"Gerakan karakter dijeda. Kamera 3D tetap bisa diputar dan digeser.":"Simulasi gerakan dilanjutkan; ini bukan aktivitas AI nyata.");
  }
  function showRoom(roomId, invite = null) {
    currentRoom=roomId||"workers";
    const requestedCctvTarget=cctvTarget;
    try {
      init();
      active=true;motionPaused=reducedMotion.matches;lastTime=0;elapsed=0;
      const motionButton=document.getElementById("vo3dMotion");if(motionButton)motionButton.textContent=motionPaused?"Lanjutkan gerakan":"Jeda gerakan";
      buildRoom(currentRoom,loadWorkers(),invite);
      resetCamera();
      if(cctvEnabled){
        if(requestedCctvTarget==="room:"+currentRoom)cctvTarget=requestedCctvTarget;
        populateCctvTargets();
        if(cctvTarget!=="room")focusCctvTarget(cctvTarget);
      }
      if(!raf)raf=requestAnimationFrame(frame);
      setStatus("Simulasi visual · model GLB kustom opsional dengan fallback karakter berartikulasi · bukan status kerja AI nyata.");
      if(host.hidden)host.hidden=false;
      resize();
    } catch (error) {
      active=false;
      const message=error&&error.message?error.message:String(error||"kesalahan tidak diketahui");
      setStatus("Ruangan 3D gagal dibuat: "+message+". Periksa dukungan WebGL browser dan muat ulang halaman.");
      const placeholder=canvasWrap?.querySelector(".vo3d-placeholder");
      if(placeholder)placeholder.textContent="Ruangan 3D gagal dibuat: "+message+". Coba browser Chrome/Edge terbaru dengan akselerasi grafis aktif.";
      console.error("[Virtual Office 3D] Gagal membuka ruangan:",error);
    }
  }
  function hideRoom(){active=false;}
  window.addEventListener("appdigi:room-open",e=>showRoom(e.detail?.id||"workers",e.detail?.invite||null));
  window.addEventListener("appdigi:agent-activity",e=>{
    const id=String(e.detail?.agentId||"").toLowerCase();
    const state=e.detail?.state;
    activityStates.set(id,state==="thinking"?"thinking":state==="speaking"?"speaking":state==="working"?"working":"idle");
    if(state==="thinking"&&id&&currentRoom!=="director"){
      const person=loadWorkers().find(w=>String(w.name||"").toLowerCase()===id);
      if(person)window.dispatchEvent(new CustomEvent("appdigi:cctv-room-select",{detail:{id:"director",invite:{id,name:person.name,role:person.role}}}));
    }
    actors.forEach(actor=>{
      const name=String(actor.userData.worker?.name||"").toLowerCase();
      const match=(id==="william"&&name.includes("william"))||name===id;
      if(match){actor.userData.conversationMode=["thinking","speaking"].includes(state)?state:null;if(state==="working")actor.userData.mode="type";if(state==="idle"){actor.userData.conversationMode=null;if(actor.userData.mode==="type")actor.userData.mode="sit";}}
    });
  });
  window.addEventListener("appdigi:agent-pose",e=>{
    const id=String(e.detail?.agentId||"").toLowerCase();
    const mode=String(e.detail?.mode||"");
    if(!["sit","type","stand","walk"].includes(mode))return;
    let found=false;
    actors.forEach(actor=>{
      const name=String(actor.userData.worker?.name||"").toLowerCase();
      if((id==="william"&&name.includes("william"))||name===id){
        actor.userData.mode=mode;actor.userData.conversationMode=null;
        actor.userData.base.position.copy(actor.position);actor.userData.base.rotation=actor.rotation.y;
        found=true;
      }
    });
    if(found){activityStates.set(id,mode==="type"?"working":mode);renderStatusHud();setStatus("Pose visual "+mode+" diterapkan pada "+id+". Gerakan karakter adalah visualisasi; status kerja mengikuti event aplikasi.");}
  });
  window.addEventListener("appdigi:room-close",hideRoom);
  window.addEventListener("storage",e=>{if(e.key===storageKey&&active)showRoom(currentRoom);});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)active=false;else if(!host.hidden){active=true;lastTime=0;}});
})();
