const $ = (selector) => document.querySelector(selector);

function drawingSurface(canvas) {
  const width = Math.round(canvas.clientWidth);
  const height = Math.round(canvas.clientHeight);
  if (!width || !height) return null;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

// Each sample stores normalized x, y, and class. Distances use the displayed aspect ratio.
const seed = [
  [.11,.76,0],[.19,.55,0],[.26,.86,0],[.32,.53,0],[.41,.66,0],
  [.48,.27,0],[.47,.43,0],[.62,.21,0],[.75,.12,0],[.87,.26,0],
  [.08,.26,1],[.22,.21,1],[.32,.31,1],[.34,.12,1],
  [.53,.75,1],[.63,.54,1],[.73,.63,1],[.84,.81,1],[.91,.52,1]
];
let samples = seed.slice();
const neighbors = $("#neighbors");
const boundaryLive = $("#boundary-live");
const cursor = { x:.5, y:.5 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function drawBoundary(canvas, points, k) {
  const surface = drawingSurface(canvas);
  if (!surface) return;
  const {ctx, width, height} = surface;
  const scaled = points.map(([x,y,group]) => [x * width, y * height, group]);
  const spacing = Math.max(5, Math.round(width / 79));
  const cols = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  const field = new Uint8Array(cols * rows);
  const distances = new Float64Array(k);
  const groups = new Uint8Array(k);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * spacing, y = row * spacing;
      distances.fill(Infinity);
      for (const [px,py,group] of scaled) {
        const d = (px-x)**2 + (py-y)**2;
        if (d >= distances[k-1]) continue;
        let slot = k-1;
        while (slot > 0 && d < distances[slot-1]) {
          distances[slot] = distances[slot-1];
          groups[slot] = groups[slot-1];
          slot--;
        }
        distances[slot] = d;
        groups[slot] = group;
      }
      let votes = 0;
      for (const group of groups) votes += group;
      field[row * cols + col] = votes > k/2 ? 1 : 0;
    }
  }
  ctx.fillStyle = "#242620";
  ctx.fillRect(0,0,width,height);
  const colors = ["#edc14d","#a3b2d5"];
  for (let row=0; row<rows; row++) {
    for (let col=0; col<cols; col++) {
      const i = row*cols+col, group = field[i];
      const edge = (col>0 && group!==field[i-1]) || (row>0 && group!==field[i-cols]);
      const x = col*spacing, y = row*spacing;
      ctx.fillStyle = group===0 ? "#594a26" : "#303743";
      ctx.fillRect(x-spacing/2,y-spacing/2,spacing,spacing);
      ctx.fillStyle = colors[group];
      ctx.beginPath();
      ctx.arc(x,y,edge ? spacing*.37 : spacing*(group===0?.19:.13),0,Math.PI*2);
      ctx.fill();
    }
  }
  for (const [x,y,group] of scaled) {
    const r = Math.max(4,width*.009);
    ctx.beginPath();
    ctx.fillStyle = "#22231f";
    ctx.arc(x,y,r+3,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = colors[group];
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    if (group===0) ctx.arc(x,y,r-1,0,Math.PI*2);
    else { ctx.moveTo(x-r*.65,y-r*.65);ctx.lineTo(x+r*.65,y+r*.65);ctx.moveTo(x+r*.65,y-r*.65);ctx.lineTo(x-r*.65,y+r*.65); }
    ctx.stroke();
  }
}
function redrawBoundary() { drawBoundary(boundaryLive, samples, Number(neighbors.value)); }
function addSample(x,y) {
  const group = Number($('input[name="point-class"]:checked').value);
  if (samples.length >= 120) samples.splice(seed.length,1);
  samples.push([x,y,group]);
  redrawBoundary();
  $("#point-status").textContent = (group===0 ? "Circle" : "Cross") + " placed. " + samples.length + " samples.";
}
boundaryLive.addEventListener("click", event => {
  const bounds = boundaryLive.getBoundingClientRect();
  addSample((event.clientX-bounds.left)/bounds.width, (event.clientY-bounds.top)/bounds.height);
});
const probe = $(".probe");
function showProbe() {
  probe.hidden = false;
  probe.style.left = cursor.x*100 + "%";
  probe.style.top = cursor.y*100 + "%";
}
boundaryLive.addEventListener("keydown", event => {
  const directions = {ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]};
  if (directions[event.key]) {
    event.preventDefault();
    const [dx,dy] = directions[event.key];
    cursor.x = clamp(cursor.x+dx,.01,.99);
    cursor.y = clamp(cursor.y+dy,.01,.99);
    showProbe();
  } else if (event.key==="Enter" || event.key===" ") {
    event.preventDefault();
    showProbe();
    addSample(cursor.x,cursor.y);
  }
});
boundaryLive.addEventListener("focus", () => { if (boundaryLive.matches(":focus-visible")) showProbe(); });
boundaryLive.addEventListener("blur", () => { probe.hidden=true; });
neighbors.addEventListener("change",redrawBoundary);
$("#reset-points").addEventListener("click", () => {
  samples = seed.slice();
  redrawBoundary();
  $("#point-status").textContent = "Initial sample points restored.";
});

const city = new Image();
city.src = "./assets/rooftop.webp";
const sampler = document.createElement("canvas");
function drawGlyph(canvas, columns, binary) {
  if (!city.naturalWidth) return;
  const surface = drawingSurface(canvas);
  if (!surface) return;
  const {ctx,width,height} = surface;
  const stepX = width / columns;
  const stepY = stepX * 1.4;
  const rows = Math.ceil(height / stepY);
  sampler.width = columns;
  sampler.height = rows;
  const small = sampler.getContext("2d",{willReadFrequently:true});
  // Sample a centered crop, keeping the buildings and sun in their original proportions.
  const scale = Math.max(width/city.naturalWidth,height/city.naturalHeight);
  const sw = width/scale, sh = height/scale;
  small.drawImage(city,(city.naturalWidth-sw)/2,(city.naturalHeight-sh)*.6,sw,sh,0,0,columns,rows);
  const pixels = small.getImageData(0,0,columns,rows).data;
  ctx.fillStyle = "#d7c9ed";
  ctx.fillRect(0,0,width,height);
  ctx.font = "bold " + (stepX*1.6) + "px monospace";
  ctx.textBaseline = "middle";
  const ramp = " .:;+ox%#@";
  for (let y=0; y<rows; y++) {
    for (let x=0; x<columns; x++) {
      const i = (y*columns+x)*4;
      const [r,g,b] = pixels.subarray(i,i+3);
      const light = (.24*r+.55*g+.21*b)/255;
      const dark = clamp((.97-light)*1.26,0,1);
      if (dark<.06) continue;
      ctx.fillStyle = r-b>65 && r>150 ? "#77519c" : "#30283c";
      const glyph = binary ? (dark>.55?"1":"0") : ramp[Math.round(dark*(ramp.length-1))];
      ctx.fillText(glyph,x*stepX,(y+.5)*stepY);
    }
  }
}
const columns = $("#columns");
function redrawGlyph() {
  $("#column-value").value = columns.value;
  drawGlyph($("#glyph-live"),Number(columns.value),$('input[name="alphabet"]:checked').value==="binary");
}
columns.addEventListener("input",redrawGlyph);
document.querySelectorAll('input[name="alphabet"]').forEach(input => input.addEventListener("change",redrawGlyph));

const projects = {
  fieldnotes: {
    title: "Fieldnotes", kind: "Sample project · Search tool", preview: "Search the collection",
    brief: "Find a detail in a notebook when you can only remember a few words. This collection follows the rooftops, shopfronts, and lettering in the illustrated city.",
    method: "Every search term must appear somewhere in a note. A match in the title carries more weight than a passing mention in the text. Open a result to read it in context.",
    stack: "JavaScript · Ranked text search · HTML"
  },
  boundary: {
    title: "Decision Boundary", kind: "Sample project · Machine learning", preview: "Inspect the classifier",
    brief: "Where does a classifier change its mind? This instrument makes the dividing line between two classes visible as you add observations.",
    method: "Each patch takes a vote from its nearest labeled points. Compare one neighbor with seven to see how an isolated observation can redraw a whole region.",
    stack: "JavaScript · k-nearest neighbors · Canvas 2D"
  },
  city: {
    title: "City in Ink", kind: "This portfolio · Frontend", preview: "Rooftop rendering study",
    brief: "An illustrated portfolio you move through from the rooftops to the street. The lighting follows you into each room.",
    method: "The day, dusk, and moonlight prints share one animation clock. The type study samples the same rooftop at a lower resolution and maps dark areas to denser characters.",
    stack: "HTML · CSS · Canvas 2D · WebP"
  }
};
const fieldnotes = [
  ["Rooftop antennas", "Drawing", "The rooftop aerials cross the sky in long, thin lines. A gap between each wire and the water tank keeps their shapes readable."],
  ["Tea at the corner", "Street", "The tea stall sits beneath the workshop. Its amber lamp catches the rim of the kettle and the sleeves of people passing the counter."],
  ["The lettering drawer", "Type", "A full stop holds the lightest shadow. Denser characters describe shutters, rooftops, and the dark underside of the awning."],
  ["Light after sunset", "Lighting", "The rooftop loses the sun before the tea stall closes. A low peach band above the skyline carries the last of the daylight."]
];
function searchNotes() {
  const terms = $("#note-query").value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const ranked = fieldnotes.map(([title, tag, body]) => {
    const fields = [title, tag, body].map(text => text.toLowerCase());
    const scores = terms.map(term => 4*fields[0].includes(term) + 2*fields[1].includes(term) + Number(fields[2].includes(term)));
    return {title, tag, body, matches: scores.every(Boolean), score: scores.reduce((sum,n)=>sum+n,0)};
  }).filter(note => note.matches).sort((a,b)=>b.score-a.score);
  $("#note-count").textContent = ranked.length ? ranked.length + (ranked.length===1 ? " note" : " notes") : "No matching notes. Try another word.";
  $("#note-results").replaceChildren(...ranked.map((note, index) => {
    const page = document.createElement("details");
    const heading = document.createElement("summary");
    const tag = document.createElement("small");
    const text = document.createElement("p");
    tag.textContent = note.tag; heading.append(tag, note.title); text.textContent = note.body;
    page.append(heading, text); page.open = index===0; return page;
  }));
}
$("#note-query").addEventListener("input", searchNotes);
searchNotes();

const dialog = $("#project-dialog");
const picker = $("#choose-project");
const files = [...document.querySelectorAll(".project-file")];
let activeProject = "";
const galleryPrint = $(".roof-painting .paint-stack").cloneNode(true);
galleryPrint.querySelector("canvas").remove();
$("#city-print").append(galleryPrint);
function setRendering() {
  const type = $('input[name="render-mode"]:checked').value==="type";
  $("#city-print").hidden = type;
  $("#city-type").hidden = !type;
  if (type && activeProject==="city") redrawGlyph();
}
document.querySelectorAll('input[name="render-mode"]').forEach(input=>input.addEventListener("change", setRendering));
function displayProject(id) {
  const project = projects[id];
  activeProject = id; picker.value = id;
  $("#project-title").textContent = project.title;
  $("#project-kind").textContent = project.kind;
  $("#project-brief").textContent = project.brief;
  $("#project-method").textContent = project.method;
  $("#project-stack").textContent = project.stack;
  $("#preview-title").textContent = project.preview;
  $("#notes-demo").hidden = id!=="fieldnotes";
  $("#boundary-demo").hidden = id!=="boundary";
  $("#glyph-demo").hidden = id!=="city";
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  if (id==="boundary") redrawBoundary();
  if (id==="city") setRendering();
}
function projectUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("project", id);
  else url.searchParams.delete("project");
  url.hash = "playground";
  return url;
}
function readProjectUrl() {
  const id = new URL(location.href).searchParams.get("project");
  if (Object.hasOwn(projects,id)) displayProject(id);
  else if (dialog.open) dialog.close();
}
files.forEach(file => file.addEventListener("click", event => {
  if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState({workshopFile:true}, "", projectUrl(file.dataset.project));
  displayProject(file.dataset.project);
}));
picker.addEventListener("change", () => {
  history.replaceState(history.state, "", projectUrl(picker.value));
  displayProject(picker.value);
});
function leaveProject() {
  if (history.state?.workshopFile) history.back();
  else { history.replaceState(history.state, "", projectUrl(null)); dialog.close(); }
}
$("#close").addEventListener("click", leaveProject);
dialog.addEventListener("cancel", event => {event.preventDefault(); leaveProject();});
dialog.addEventListener("click", event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target===dialog && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) leaveProject();
});
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  files.find(file=>file.dataset.project===activeProject)?.focus({preventScroll:true});
  activeProject = "";
});
addEventListener("popstate", readProjectUrl);
readProjectUrl();
const cover = $("#boundary-cover");
const previewResize = new ResizeObserver(entries => {
  for (const {target} of entries) {
    if (target===cover.parentElement) drawBoundary(cover, seed, 3);
    else if (activeProject==="boundary" && target.contains(boundaryLive)) redrawBoundary();
    else if (activeProject==="city" && !$("#city-type").hidden && target.contains($("#glyph-live"))) redrawGlyph();
  }
});
previewResize.observe(cover.parentElement);
document.querySelectorAll(".demo-stage").forEach(stage=>previewResize.observe(stage));
city.addEventListener("load", () => { if (activeProject==="city" && !$("#city-type").hidden) redrawGlyph(); });
