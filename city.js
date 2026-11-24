(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const select = (selector) => document.querySelector(selector);
  const limit = (n) => Math.min(1, Math.max(0, n));
  const mix = (a, b, t) => a + (b - a) * t;
  function smooth(from, to, value) {
    const t = limit((value - from) / (to - from));
    return t * t * (3 - 2 * t);
  }
  function loadImage(src) {
    const image = new Image();
    image.src = "./assets/" + src;
    return image;
  }

  const roof = select(".roof-painting");
  const shop = select(".workroom");
  const shopStop = select(".chapter-shop");
  const stage = select(".viewfinder");
  const world = select(".city-world");
  const roofShade = select(".roof-shade");
  const roomShade = select(".room-shade");
  const roofCopy = select(".chapter-roof .chapter-copy");
  const shopCopy = select(".chapter-shop .chapter-copy");
  const shopHeading = select(".shop-heading");
  const shelf = select(".project-shelf");
  const projectDialog = select("#project-dialog");
  const progressBar = select(".travel-line span");
  const street = select(".street-world");
  const streetStop = select("#street");
  const facade = select(".street-set");
  const credit = select(".colophon");
  const header = select(".mast");
  const navLinks = [...document.querySelectorAll("nav a")];
  const lightChoices = [...document.querySelectorAll('input[name="city-light"]')];
  const browserColor = select('meta[name="theme-color"]');
  const skyMask = loadImage("sky-mask.webp");
  const sky = select(".sky-life");
  const skyContext = sky.getContext("2d");
  const room = select(".building-view");
  const crtScan = select(".crt-scan");
  const people = select("#pedestrians");
  const streetContext = people.getContext("2d");
  const residentX = 1195; // The pale doorjamb beside the tea stall.
  let phase = 0;
  const lights = ["day", "dusk", "night"];
  const weights = [1, 0, 0];
  const velocities = [0, 0, 0];
  let target = 0;
  let lighting = false;
  let roofVisible = false;
  let skyVisible = false;
  let workshopVisible = false;
  let benchTime = 0;
  let lastLampFrame = -1;
  let streetVisible = false;
  let cameraY = null;
  let cameraVelocity = 0;
  let lastY = scrollY;
  let direction = 0;
  let destination = null;
  let settleTimer = 0;
  let touchHeld = false;
  let scrollbarHeld = false;
  let geometry;
  let pixelRatio = 0;
  let skyWidth = 0, skyHeight = 0;
  let geometryDirty = true;
  let scrollDirty = true;
  let frame = 0;
  let previous = null;
  let skyTime = 0;
  let sceneWidth = 0;
  let sceneHeight = 0;
  let streetDepth = 0;
  let paintedWidth = 0, paintedHeight = 0, paintedLeft = 0, paintedTop = 0;
  let pavement, inkBounds, laneEntrance;
  let streetTime=0;
  let lampX = 0;
  let streetLight = null;
  let actors = [];
  let nextCast = 0;
  let activeStop = -1;
  const papers = [[248,247,242], [228,219,234], [25,27,34]];
  const accents = [[239,178,26], [183,81,50], [255,205,99]];
  const rules = [[174,172,158], [172,153,173], [103,107,113]];
  const solarInks = [[255,193,0], [237,135,92], [215,152,122]];
  function tone(palette, contributions) {
    return "rgb(" + palette[0].map((_, channel) => Math.round(
      contributions.reduce((sum, weight, i) => sum + weight * palette[i][channel], 0)
    )).join(" ") + ")";
  }
  skyMask.decode().then(() => { root.dataset.skyReady = ""; }).catch(() => {});
  function paintLight() {
    const [day, dusk, night] = weights;
    phase = dusk * .5 + night;
    const paper = tone(papers, weights);
    const duskShare = day + dusk > .0001 ? dusk / (day + dusk) : 0;
    const polarity = smooth(.57, .67, night);
    const typeWeights = [(1-polarity)*(1-duskShare), (1-polarity)*duskShare, polarity];
    const style = root.style;
    style.setProperty("--paper", paper);
    style.setProperty("--ink", tone([[30,32,28],[53,42,58],[249,244,233]], typeWeights));
    style.setProperty("--muted", tone([[71,71,62],[90,73,94],[216,215,204]], typeWeights));
    style.setProperty("--ink-edge", "rgb(18 15 29 / " + (Math.sin(polarity * Math.PI) * .85) + ")");
    style.setProperty("--rule", tone(rules, weights));
    style.setProperty("--sun", tone(accents, weights));
    lights.forEach((name, i) => style.setProperty("--" + name, weights[i]));
    style.setProperty("--dial", phase * 200 + "%");
    style.setProperty("--sun-x", 53.2*day + 46*dusk + 39*night + "%");
    style.setProperty("--sun-y", 38*day + 94*dusk + 112*night + "%");
    style.setProperty("--sun-size", 48.9*day + 29*dusk + 18*night + "%");
    style.setProperty("--sun-ink", tone(solarInks, weights));
    style.setProperty("--moon-x", mix(58,52.2,night) + "%");
    style.setProperty("--moon-y", mix(91,24,night) + "%");
    browserColor.content = paper;
  }
  function settleLight() {
    lights.forEach((_, i) => { weights[i] = Number(i === target); velocities[i] = 0; });
    lighting = false;
    paintLight();
    root.dataset.theme = lights[target];
  }
  function advanceLight(dt) {
    // Exact critically damped spring. A new destination keeps the velocity of each print.
    const rate = reduced.matches ? 4.2 : 3.45;
    const decay = Math.exp(-rate * dt);
    let moving = false;
    weights.forEach((weight, i) => {
      const destination = Number(i === target);
      const offset = weight - destination;
      const slope = velocities[i] + rate * offset;
      weights[i] = destination + (offset + slope * dt) * decay;
      velocities[i] = (velocities[i] - rate * slope * dt) * decay;
      if (Math.abs(weights[i]-destination) > .0008 || Math.abs(velocities[i]) > .003) moving = true;
    });
    if (moving) paintLight();
    else settleLight();
  }
  lightChoices.forEach((input, i) => input.addEventListener("change", () => {
    if (!input.checked) return;
    try { localStorage.setItem("subir-view", lights[i]); } catch {}
    // Start the shared fade only when the destination artwork on screen can paint.
    const visibleScenes = [];
    if (workshopVisible) visibleScenes.push(shop);
    if (streetVisible) visibleScenes.push(street);
    if (roofVisible || !visibleScenes.length) visibleScenes.push(roof);
    const images = visibleScenes.flatMap(scene => [...scene.querySelectorAll('[data-light="' + lights[i] + '"] img')]);
    Promise.allSettled(images.map(image => image.decode())).then(() => {
      if (!input.checked) return;
      target = i;
      lighting = true;
      wake();
    });
  }));

  // Find a cover crop in world coordinates. Every viewport corner lands inside
  // the actual painting, even when the screen is very tall or very wide.
  function coverShot(x, y, width, height, screenW, screenH, alignX, alignY) {
    const scale = Math.max(screenW/width, screenH/height);
    return {
      scale,
      x: x + width*alignX + screenW/scale*(.5-alignX),
      y: y + height*alignY + screenH/scale*(.5-alignY)
    };
  }

  function measureCamera(nativeY) {
    const w = stage.clientWidth, h = stage.clientHeight;
    const mast = header.offsetHeight, portrait = h>w;
    const shelfY = nativeY + shopStop.getBoundingClientRect().top - mast;
    const pavementY = Math.min(root.scrollHeight-h, nativeY + streetStop.getBoundingClientRect().top);
    const rw = roof.offsetWidth, rh = rw*2/3;
    const opening = coverShot(
      roof.offsetLeft + .026*rw, roof.offsetTop + .018*rh, .948*rw, .82*rh,
      w, h, portrait ? .66 : .52, .38
    );
    const desk = coverShot(
      shop.offsetLeft + 8, shop.offsetTop + 8, shop.offsetWidth - 16, shop.offsetHeight - 16,
      w, h, portrait ? .70 : .52, .53
    );
    const streetScale = portrait ? Math.min(w/680,(h-credit.offsetHeight)*.8/827) : Math.min(w*.99/1902,(h-credit.offsetHeight)*.86/827);
    const streetLeft = portrait ? w*.53-residentX*streetScale : (w-1902*streetScale)/2;
    const streetTop = h-credit.offsetHeight-827*streetScale;
    const wide = {scale:streetScale, x:(w*.5-streetLeft)/streetScale, y:(h*.5-streetTop)/streetScale};
    skyWidth = sky.clientWidth;
    skyHeight = rh;
    return {w, h, shelfY, pavementY, opening, desk, wide, roofBase:roof.offsetTop+rh};
  }

  function updateLayout(y, nativeY) {
    const {w, h, shelfY, pavementY, opening, desk, wide, roofBase} = geometry;
    const aboveShop = y <= shelfY;
    const travel = aboveShop ? limit(y/Math.max(1,shelfY)) : limit((y-shelfY)/Math.max(1,pavementY-shelfY));
    const from = aboveShop ? opening : desk, to = aboveShop ? desk : wide;
    // Crane past the ledge first, then push through the window. Hold the room
    // across the reading stop; on departure lower the lens before pulling wide.
    // Reduced motion keeps the pan and lens on one steady, scroll-driven path.
    const linear = aboveShop ? limit(travel/.86) : limit((travel-.16)/.80);
    const pan = reduced.matches ? linear : aboveShop ? smooth(.02,.85,travel) : smooth(.16,.92,travel);
    const zoom = reduced.matches ? linear : aboveShop ? smooth(.31,.86,travel) : smooth(.27,.96,travel);
    const scale = Math.exp(mix(Math.log(from.scale),Math.log(to.scale),zoom));
    const left = w*.5 - mix(from.x,to.x,pan)*scale;
    const top = h*.5 - mix(from.y,to.y,pan)*scale;
    world.style.transform = `matrix(${scale},0,0,${scale},${left},${top})`;
    // The foreground railing moves across the more distant rooftop as the
    // camera passes it. Once inside, occlude the entire roof including its sky.
    const setback = reduced.matches ? 0 : 125*smooth(.03,.53,travel);
    roof.style.transform = `translateY(${aboveShop ? setback : 0}px)`;
    const roofBottom = top+(roofBase+setback)*scale;
    roofVisible = aboveShop && travel<.86 && roofBottom>0;
    roof.toggleAttribute("data-away", !roofVisible);
    const roofCaption = aboveShop ? 1-smooth(0,.29,travel) : 0;
    const roomCaption = aboveShop ? smooth(.77,.94,travel) : 1-smooth(.01,.15,travel);
    // The desk files leave during the camera hold, before the room starts moving.
    const filesOpacity = aboveShop ? smooth(.87,.99,travel) : 1-smooth(0,.095,travel);
    roofShade.style.opacity = roofCopy.style.opacity = roofCaption;
    roomShade.style.opacity = shopCopy.style.opacity = roomCaption;
    const lift = reduced.matches ? 0 : Math.min(32,h*.035);
    roofCopy.style.transform = `translate3d(0,${(roofCaption-1)*lift}px,0)`;
    shopHeading.style.transform = `translate3d(0,${(1-roomCaption)*(aboveShop ? lift : -lift)}px,0)`;
    shelf.style.opacity = filesOpacity;
    shelf.style.visibility = filesOpacity ? "" : "hidden";
    shelf.toggleAttribute("inert", filesOpacity < .995 || Math.abs(nativeY-shelfY) > 3);
    roofCopy.toggleAttribute("inert", roofCaption < .95);
    roofCopy.style.visibility = roofCaption ? "" : "hidden";
    shopCopy.style.visibility = roomCaption || filesOpacity ? "" : "hidden";
    progressBar.style.transform = `scaleX(${limit(y/Math.max(1,pavementY))})`;
    const current = aboveShop ? (travel>.66 ? 1 : 0) : (travel>.63 ? 2 : 1);
    if (current !== activeStop) {
      navLinks.forEach((a,i) => i===current ? a.setAttribute("aria-current","location") : a.removeAttribute("aria-current"));
      activeStop = current;
    }
    workshopVisible = top+379*scale > 0 && top+169*scale < h;
    skyVisible = roofVisible && roofBottom-skyHeight*.64*scale>0;
    const insideRoom = left+1097*scale<=0 && left+1498*scale>=w &&
      top+175*scale<=0 && top+373*scale>=h;
    facade.style.visibility = (top>=h || insideRoom) ? "hidden" : "";
    streetVisible = top+sceneHeight*.60*scale < h && top+810*scale > 0;
    scrollDirty = false;
  }

  function fitCanvas(canvas, ctx, density, originY = 0) {
    if (!ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    // Bound backing-store memory on high-density monitors while preserving CSS coordinates.
    const ratio = Math.min(density, Math.sqrt(8_000_000 / (width * height)));
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(w / width, 0, 0, h / height, 0, -originY*h/height);
  }

  function drawSky() {
    if (!skyContext) return;
    const ctx = skyContext, w = skyWidth, h = skyHeight;
    if (!w || !h) return;
    ctx.clearRect(0,0,w,h);
    if (reduced.matches) return;
    ctx.save();
    ctx.globalAlpha = weights[0] + weights[1] * .83;
    ctx.strokeStyle = "#302b24";
    ctx.lineWidth = Math.max(1.1,w*.0027);
    ctx.lineCap = "round";
    // A loose flock follows a shallow arc. Each bird beats its wings out of phase.
    for (let i=0; i<6; i++) {
      const flight = ((skyTime*.030+.34-i*.028)%1+1)%1;
      const x = w*(flight*1.12-.06);
      const y = h*(.21-.082*Math.sin(flight*Math.PI)+.036*Math.sin(i*2.4+skyTime*.61));
      const wing = w*(.0068+.0015*(i%3));
      const lift = wing*(.15+.65*Math.sin(skyTime*6.4+i*1.8));
      ctx.beginPath();
      ctx.moveTo(x-wing,y-lift);
      ctx.quadraticCurveTo(x-wing*.36,y-lift*1.15,x,y+wing*.15);
      ctx.quadraticCurveTo(x+wing*.42,y-lift*1.1,x+wing,y-lift);
      ctx.stroke();
    }
    for (let i=0; i<15; i++) {
      const x = (.04+((i*.173)% .86))*w;
      const y = (.035+((i*.167)% .28))*h;
      ctx.globalAlpha = (weights[2] + weights[1] * .005)*(.4+.35*Math.sin(skyTime*1.05+i));
      ctx.fillStyle = "#fff1bf";
      ctx.beginPath();
      ctx.arc(x,y,Math.max(.6,w*.00145),0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  const sheets = [];
  // One paper-and-ink palette per person, sampled from the shutters, awning and masonry.
  const fabricInks = [
    "#bdc4b3", "#c8ac86", "#d9c3a2", "#c0a17c", "#a9b9b4", "#d4ba91",
    "#b2afa0", "#a6b5ba", "#c7a38c", "#c3b184", "#c99e7f", "#bbc1ac"
  ];
  function colorPrint(source, inks) {
    const print = document.createElement("canvas");
    print.width = source.naturalWidth;
    print.height = source.naturalHeight;
    const ctx = print.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    const rowHeight = print.height / inks.length;
    inks.forEach((ink, row) => {
      const y = row * rowHeight;
      const wash = ctx.createLinearGradient(0, y, 0, y + rowHeight);
      wash.addColorStop(0, "#e6cba2");
      wash.addColorStop(.18, "#e6cba2");
      wash.addColorStop(.32, ink);
      wash.addColorStop(.62, ink);
      wash.addColorStop(.90, "#c9bea9");
      wash.addColorStop(1, "#c2b49c");
      ctx.fillStyle = wash;
      ctx.fillRect(0, y, print.width, rowHeight);
    });
    // Restore the original transparent silhouette after laying down the colored ink.
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(source, 0, 0);
    return print;
  }
  function drawWorkbench() {
    // The filament and all its casts share one smooth signal. A fixed lamp
    // changes shadow contrast as it dims; contact points stay on the desk.
    const t = reduced.matches ? 0 : benchTime;
    const lampFrame = Math.floor(t*30);
    if (lampFrame === lastLampFrame) return;
    lastLampFrame = lampFrame;
    const cycle = t % 8.9;
    const dip = Math.exp(-(((cycle-2.65)/.29)**2)) + .47*Math.exp(-(((cycle-3.16)/.19)**2));
    const power = reduced.matches ? .88 :
      .88 + .042*Math.sin(t*3.17) + .022*Math.sin(t*8.51+.8) + .015*Math.sin(t*13.39) - .205*dip;
    room.style.setProperty("--filament", power.toFixed(3));
    if (!reduced.matches) crtScan.setAttribute("transform", `translate(0 ${(t*28)%157})`);
  }

  let resident;
  // Read the bottom of each pose once. Two separate soles can be at different
  // heights, and crossed legs naturally produce a single contact patch.
  function prepareCast(source, inks, columns) {
    const rows = inks.length;
    const shadow = document.createElement("canvas");
    const cellW = Math.max(1,Math.round(source.naturalWidth / columns / 4));
    const cellH = Math.max(1,Math.round(source.naturalHeight / rows / 4));
    shadow.width = columns*cellW; shadow.height = rows*cellH;
    const ctx = shadow.getContext("2d", {willReadFrequently:true});
    ctx.drawImage(source,0,0,shadow.width,shadow.height);
    const alpha = ctx.getImageData(0,0,shadow.width,shadow.height).data;
    const poses = [];
    for (let row=0; row<rows; row++) {
      for (let col=0; col<columns; col++) {
        const bottoms = new Int16Array(cellW).fill(-1);
        for (let x=0; x<cellW; x++) {
          for (let y=cellH-1; y>=cellH*.75; y--) {
            const index = ((row*cellH+y)*shadow.width + col*cellW+x)*4+3;
            if (alpha[index]>75) { bottoms[x]=y; break; }
          }
        }
        const sole = Math.max(...bottoms);
        const feet = [];
        let start = -1;
        for (let x=0; x<=cellW; x++) {
          if (x<cellW && bottoms[x]>=sole-cellH*.115) {
            if (start<0) start=x;
          } else if (start>=0) {
            const end=x;
            const low=Math.max(...bottoms.subarray(start,end));
            let sum=0,count=0;
            for (let j=start; j<end; j++) if (bottoms[j]>=low-1) { sum+=j+.5; count++; }
            if (count && end-start>=2) feet.push({x:sum/count/cellW-.5, lift:(sole-low)/cellH, width:(end-start)/cellW});
            start=-1;
          }
        }
        poses.push({sole:(sole+1)/cellH, feet});
      }
    }
    ctx.globalCompositeOperation="source-in";
    ctx.fillStyle="#211d28"; ctx.fillRect(0,0,shadow.width,shadow.height);
    const soft=document.createElement("canvas");
    soft.width=shadow.width; soft.height=shadow.height;
    const softened=soft.getContext("2d");
    softened.filter="blur(.8px)";
    softened.drawImage(shadow,0,0);
    softened.filter="none";
    softened.globalCompositeOperation="destination-in";
    for (let row=0; row<rows; row++) {
      const y=row*cellH;
      const fade=softened.createLinearGradient(0,y,0,y+cellH);
      fade.addColorStop(0,"rgba(0,0,0,.56)"); fade.addColorStop(.7,"rgba(0,0,0,.85)"); fade.addColorStop(1,"black");
      softened.save();
      softened.beginPath(); softened.rect(0,y,soft.width,cellH); softened.clip();
      softened.fillStyle=fade; softened.fillRect(0,y,soft.width,cellH);
      softened.restore();
    }
    return {print:colorPrint(source,inks), shadow:soft, poses, rows, columns};
  }
  function loadPrint(filename, inks, receive) {
    const image = new Image();
    image.onload = () => {
      receive(prepareCast(image, inks, inks.length===1 ? 1 : 8));
      wake();
    };
    image.src = "./assets/" + filename;
  }
  function fetchCast() {
    if (sheets.length) return;
    for (let i=0;i<4;i++) {
      sheets.push(null);
      loadPrint("walk-" + i + ".webp", fabricInks.slice(i*3, i*3+3), print => { sheets[i] = print; });
    }
    loadPrint("street-0.webp", ["#d7c9a9"], print => { resident = print; });
  }
  // Different rows on each sheet depict different people. Space related outfits apart.
  const cast = [4,1,8,10,0,5,9,2,7,11,3,6];
  const builds = [1,.98,.91,1.05,1.06,.86,1.02,.97,.88,1.05,.90,.96];
  function resizeStreet() {
    const width = street.clientWidth, height = street.clientHeight;
    if (!width || !height || (width===sceneWidth && height===sceneHeight)) return;
    const count = Math.min(12,Math.max(width<600 ? 6 : 7,Math.round(width/Math.max(124,height*.21))));
    const backCount = Math.ceil(count*.55);
    const previousWidth = sceneWidth || width;
    sceneWidth = width;
    sceneHeight = height;
    streetDepth = smooth(.65, 1.75, width / height);
    // Object-fit may crop the panorama on phones. Keep the light tied to the actual tea stall.
    paintedWidth = Math.max(width, height * 1902 / 827);
    paintedHeight = paintedWidth * 827 / 1902;
    paintedLeft = (width-paintedWidth)*.68;
    paintedTop = height-paintedHeight;
    lampX = paintedLeft + paintedWidth*.568;
    // The bounds follow the outer ink, curb and right-hand edge of the tea canopy.
    // All coordinates live in the original painting, including on a cropped phone view.
    function streetPath(points) {
      const path=new Path2D();
      points.forEach(([x,y],i)=>path[i ? "lineTo":"moveTo"](paintedLeft+x*paintedWidth,paintedTop+y*paintedHeight));
      path.closePath();
      return path;
    }
    inkBounds=streetPath([[.01,0],[.985,0],[.985,.94],[.965,.963],[.045,.968],[.01,.944]]);
    pavement=streetPath([[.01,.927],[.177,.92],[.22,.897],[.37,.862],[.41,.899],[.51,.921],[.985,.925],[.985,.944],[.965,.963],[.045,.968],[.01,.944]]);
    laneEntrance=streetPath([[.191,0],[1,0],[1,1],[.177,1],[.177,.755],[.198,.743],[.183,.717]]);
    if (streetContext) {
      streetLight = streetContext.createRadialGradient(lampX, height*.87, 0, lampX, height*.87, paintedWidth*.195);
      streetLight.addColorStop(0, "rgba(234,169,73,.29)");
      streetLight.addColorStop(.38, "rgba(122,94,77,.30)");
      streetLight.addColorStop(1, "rgba(20,29,61,.59)");
    }
    const previousActors = actors;
    actors = Array.from({length:count}, (_,i) => {
      const back = i<backCount;
      const laneCount = back ? backCount : count-backCount;
      const laneIndex = back ? i : i-backCount;
      const old = previousActors.length===count ? previousActors[i] : null;
      const person = old?.person ?? cast[i];
      const entry = back ? Math.max(0,paintedLeft+.18*paintedWidth) : 0;
      const x = old ? old.x * width/previousWidth : entry + (width-entry)*((laneIndex+(back?.19:.56))/laneCount);
      return {person,back,x,phase:old?.phase ?? (i*.317)%1,lane:(i%3)*.002,direction:back?1:-1};
    });
    if (!previousActors.length) nextCast = count%cast.length;
  }
  function replaceActor(actor) {
    // Do not reuse a face while that person is elsewhere on the pavement.
    for (let i=0;i<cast.length;i++) {
      const person = cast[nextCast];
      nextCast = (nextCast+1)%cast.length;
      if (!actors.some(other=>other!==actor && other.person===person)) {
        actor.person=person;
        return;
      }
    }
  }
  function streetPose(asset, row, frame, x, ground, height, direction, back) {
    const width=height*(asset.print.width/asset.columns)/(asset.print.height/asset.rows);
    return {asset, row, frame, x, ground, width, height, direction, back, foot:asset.poses[row*asset.columns+frame]};
  }
  function stepActor(actor, dt) {
    const asset = sheets[Math.floor(actor.person/3)];
    if (!asset) return null;
    const u = (actor.x-paintedLeft)/paintedWidth;
    const approach = smooth(.18,.43,u);
    const scale = actor.back ? mix(.185,.162,streetDepth)*mix(.54,1,approach) : mix(.273,.235,streetDepth);
    const height = sceneHeight*scale*builds[actor.person];
    const cadence = .89+(actor.person%4)*.066;
    const stride = height*(.98+(actor.person%3)*.085);
    actor.phase = (actor.phase+dt*cadence)%1;
    actor.x += actor.direction*dt*cadence*stride;
    const left = actor.back ? Math.max(0,paintedLeft+.17*paintedWidth) : 0;
    // Wrap only after the entire silhouette and its penumbra have passed the edge.
    const margin=height*1.65;
    if (actor.direction===1 ? actor.x>sceneWidth+margin : actor.x<left-margin) {
      actor.x=actor.direction===1 ? left-margin : sceneWidth+margin;
      replaceActor(actor);
      return null;
    }
    const ground = paintedTop+paintedHeight*((actor.back ? mix(.916,.937,approach) : .953)+actor.lane);
    return streetPose(asset,actor.person%3,Math.floor(actor.phase*8),actor.x,ground,height,actor.direction,actor.back);
  }
  function stampPose(ctx, person, image) {
    const {asset,row,frame,width,height,foot}=person;
    const sw=image.width/asset.columns, sh=image.height/asset.rows;
    ctx.drawImage(image,frame*sw,row*sh,sw,sh,-width/2,-foot.sole*height,width,height);
  }
  const shoeShadow=document.createElement("canvas");
  shoeShadow.width=shoeShadow.height=48;
  const shoeContext=shoeShadow.getContext("2d");
  const falloff=shoeContext.createRadialGradient(24,24,0,24,24,24);
  falloff.addColorStop(0,"#17131a"); falloff.addColorStop(1,"rgba(23,19,26,0)");
  shoeContext.fillStyle=falloff; shoeContext.fillRect(0,0,48,48);
  function castSilhouette(ctx, person, dx, dy, opacity) {
    if (opacity<.002) return;
    ctx.save();
    ctx.globalAlpha=opacity;
    ctx.transform(person.direction,0,-dx,-dy,0,0);
    stampPose(ctx,person,person.asset.shadow);
    ctx.restore();
  }
  function drawShadow(person) {
    const ctx=streetContext, {x,ground,height,width,foot,direction}=person;
    const relative=(x-lampX)/paintedHeight;
    const lampStrength=Math.exp(-Math.abs(relative)*3.2);
    const [day,dusk,night]=weights;
    const eveningShare=dusk/Math.max(.0001,day+dusk);
    ctx.save();
    if (person.back) ctx.clip(laneEntrance);
    ctx.translate(x,ground);
    // The broad sky casts along the paving stones. An independent local cast
    // spreads away from the tea-stall bulb as a walker crosses its pool of light.
    castSilhouette(ctx,person,mix(.41,.91,eveningShare),-.042,.35*day+.16*dusk+.075*night);
    castSilhouette(ctx,person,Math.tanh(relative*3.2)*1.18,.065,(.16*dusk+.62*night)*lampStrength);
    for (const shoe of foot.feet) {
      const contact=1-smooth(0,.115,shoe.lift);
      const radius=Math.max(.9,width*shoe.width*(.42+.18*(1-contact)));
      const ry=Math.max(.65,height*.012);
      ctx.globalAlpha=.18+.45*contact;
      ctx.drawImage(shoeShadow,direction*shoe.x*width-radius,height*.002-ry,radius*2,ry*2);
    }
    ctx.restore();
  }
  function drawStreet(dt) {
    if (!streetContext) return;
    fetchCast();
    const ctx=streetContext;
    ctx.clearRect(0,0,sceneWidth,sceneHeight);
    // Steam rises from the painted kettle, behind the pedestrians.
    if (!reduced.matches) {
      streetTime+=dt;
      const kettleX=paintedLeft+paintedWidth*.534, kettleY=paintedTop+paintedHeight*.766;
      ctx.save();
      ctx.strokeStyle="rgba(244,220,180,"+(.26+.18*weights[2])+")";
      ctx.lineWidth=Math.max(.7,paintedHeight*.0018); ctx.lineCap="round";
      for (let i=0; i<3; i++) {
        const t=(streetTime*.38+i/3)%1;
        const y=kettleY-t*paintedHeight*.054;
        const x=kettleX+Math.sin(t*5+i)*paintedHeight*.0035;
        ctx.globalAlpha=Math.sin(Math.PI*t);
        ctx.beginPath(); ctx.moveTo(x,y);
        ctx.bezierCurveTo(x-paintedHeight*.011,y-paintedHeight*.009,x+paintedHeight*.012,y-paintedHeight*.019,x+paintedHeight*.004,y-paintedHeight*.03);
        ctx.stroke();
      }
      ctx.restore();
    }
    const walkers=actors.map(actor=>stepActor(actor,dt)).filter(Boolean);
    if (resident) {
      walkers.push(streetPose(resident,0,0,paintedLeft+paintedWidth*residentX/1902,paintedTop+paintedHeight*.937,sceneHeight*mix(.24,.215,streetDepth),1,false));
    }
    walkers.sort((a,b)=>a.ground-b.ground);
    ctx.save(); ctx.clip(pavement);
    walkers.forEach(drawShadow);
    ctx.restore();
    ctx.save(); ctx.clip(inkBounds);
    for (const person of walkers) {
      ctx.save();
      if (person.back) ctx.clip(laneEntrance);
      ctx.translate(person.x,person.ground);
      ctx.scale(person.direction,1);
      stampPose(ctx,person,person.asset.print);
      ctx.restore();
    }
    ctx.restore();
    if (phase > 0 && streetLight) {
      // Apply the street's light only to the ink already on this transparent layer.
      streetContext.save();
      streetContext.globalCompositeOperation = "source-atop";
      streetContext.globalAlpha = weights[1] * .43 + weights[2];
      streetContext.fillStyle = streetLight;
      streetContext.fillRect(0,0,sceneWidth,sceneHeight);
      streetContext.restore();
    }
  }

  function tick(time) {
    frame = 0;
    const dt = previous === null ? 0 : Math.min(.05,(time-previous)/1000);
    previous = time;
    let nativeY = scrollY;
    const displayRatio = devicePixelRatio || 1;
    if (geometryDirty || displayRatio !== pixelRatio) {
      pixelRatio = displayRatio;
      const old = geometry;
      geometry = measureCamera(nativeY);
      // Rotating a phone or resizing a window moves the anchors in the
      // document. Keep an occupied stop (or an ongoing snap) at the same scene.
      if (old && (old.shelfY !== geometry.shelfY || old.pavementY !== geometry.pavementY)) {
        const restingY = destination ?? cameraY;
        const wasAt = key => restingY !== null && Math.abs(restingY-old[key]) <= 1;
        const key = wasAt("shelfY") ? "shelfY" : wasAt("pavementY") ? "pavementY" : null;
        if (key && !touchHeld && !scrollbarHeld) {
          clearTimeout(settleTimer);
          direction = 0;
          destination = null;
          window.scrollTo({top:geometry[key],behavior:"instant"});
          nativeY = lastY = cameraY = scrollY;
          cameraVelocity = 0;
        }
      }
      fitCanvas(sky,skyContext,Math.min(2,displayRatio));
      // The camera enlarges this world-space canvas on wide screens.
      // Render the street at its final physical pixel density before compositing.
      const streetDensity = Math.max(1, geometry.wide.scale * displayRatio);
      fitCanvas(people,streetContext,streetDensity,people.offsetTop);
      resizeStreet();
      geometryDirty = false;
      scrollDirty = true;
    }
    if (cameraY === null) {
      cameraY = nativeY;
      cameraVelocity = 0;
      root.setAttribute("data-camera-ready", "");
    }
    if (scrollDirty || cameraY !== nativeY) {
      // A critically damped follower keeps moving between spaced wheel events.
      // Bound its destination to keep a large jump on the same continuous path.
      const rate = reduced.matches ? 32 : 24;
      const horizon = geometry.h * 4.8/rate;
      const goal = cameraY + Math.max(-horizon, Math.min(horizon, nativeY-cameraY));
      const seconds = dt || 1/60;
      const offset = cameraY-goal, slope = cameraVelocity+rate*offset;
      const decay = Math.exp(-rate*seconds);
      cameraY = goal + (offset+slope*seconds)*decay;
      cameraVelocity = (cameraVelocity-rate*slope*seconds)*decay;
      if (Math.abs(nativeY-cameraY)<.1 && Math.abs(cameraVelocity)<3) {
        cameraY = nativeY;
        cameraVelocity = 0;
      }
      updateLayout(cameraY, nativeY);
    }
    if (lighting) advanceLight(dt);
    if (skyVisible) {
      skyTime += dt;
      drawSky();
    }
    if (workshopVisible) {
      if (!reduced.matches) benchTime += dt;
      drawWorkbench();
    }
    if (streetVisible) {
      drawStreet(reduced.matches ? dt * .55 : dt);
    }
    const animated = cameraY !== nativeY || streetVisible || lighting || ((skyVisible || workshopVisible) && !reduced.matches);
    if (animated) wake();
    else previous = null;
  }
  function wake() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }
  // Let each gesture scrub the real document. Once it goes quiet, a short
  // deliberate movement commits to the next stop in its direction.
  function settleScroll() {
    if (!geometry || !direction || touchHeld || scrollbarHeld || projectDialog.open || document.hidden) return;
    const y = scrollY;
    const {shelfY, pavementY, h} = geometry;
    const start = y < shelfY ? 0 : shelfY;
    const end = y < shelfY ? shelfY : pavementY;
    const threshold = Math.min(72,Math.max(40,h*.07));
    const stop = direction > 0
      ? (y-start >= threshold ? end : start)
      : (end-y >= threshold ? start : end);
    direction = 0;
    if (Math.abs(stop-y) <= 1) return;
    destination = stop;
    window.scrollTo({top:stop,behavior:reduced.matches ? "instant" : "smooth"});
  }
  function queueSettle() {
    clearTimeout(settleTimer);
    if (direction && !touchHeld && !scrollbarHeld) settleTimer = setTimeout(settleScroll,140);
  }
  function interruptSettle() {
    if (destination !== null) {
      direction = Math.sign(destination-scrollY);
      destination = null;
      window.scrollTo({top:scrollY,behavior:"instant"});
    }
    queueSettle();
  }
  function onPageScroll() {
    const y = scrollY;
    if (geometry && Math.abs(y-geometry.shelfY)>3 && !shelf.inert) shelf.inert = true;
    scrollDirty = true;
    wake();
    if (destination !== null) {
      if (Math.abs(y-destination) <= 1) destination = null;
    } else if (y !== lastY) {
      direction = Math.sign(y-lastY);
      queueSettle();
    }
    lastY = y;
  }
  wake();
  function requestMeasure() { geometryDirty=true; wake(); }
  addEventListener("resize",requestMeasure);
  const resize = new ResizeObserver(requestMeasure);
  [document.body, stage, header, shopStop, sky, people].forEach(el=>resize.observe(el));
  const preloadCrowd = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { fetchCast(); preloadCrowd.disconnect(); }
  }, {rootMargin:"100% 0px"});
  preloadCrowd.observe(shopStop);
  // A deep link, back/forward restoration, and a scroll all take the same entry path.
  addEventListener("scroll",onPageScroll,{passive:true});
  addEventListener("wheel",event => {
    if (event.deltaY && !event.ctrlKey && !projectDialog.open) interruptSettle();
  },{passive:true});
  addEventListener("touchstart",() => { touchHeld=true; interruptSettle(); },{passive:true});
  function releaseTouch(event) { touchHeld=event.touches.length>0; queueSettle(); }
  addEventListener("touchend",releaseTouch,{passive:true});
  addEventListener("touchcancel",releaseTouch,{passive:true});
  addEventListener("pointerdown",event => {
    scrollbarHeld = event.pointerType==="mouse" && event.clientX>=root.clientWidth;
    interruptSettle();
  },{passive:true});
  addEventListener("pointerup",() => { scrollbarHeld=false; queueSettle(); },{passive:true});
  addEventListener("keydown",event => {
    if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," ","Tab"].includes(event.key)) interruptSettle();
  });
  addEventListener("pageshow",() => { lastY=scrollY; cameraY=null; geometryDirty=true; wake(); });
  document.addEventListener("visibilitychange",() => {
    cancelAnimationFrame(frame);
    frame=0;
    previous=null;
    if (!document.hidden) { scrollDirty=true; wake(); queueSettle(); }
  });
  reduced.addEventListener("change",() => {
    scrollDirty=true;
    wake();
  });
  target = Math.max(0, lights.indexOf(root.dataset.theme));
  root.dataset.theme = lights[target];
  lightChoices[target].checked = true;
  settleLight();
})();
