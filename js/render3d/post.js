// Posproceso del visor, como en los juegos: la escena se dibuja en alto rango
// dinámico (HDR) con antialias, y al final se le añade oclusión ambiental en
// pantalla, resplandor de las zonas brillantes (bloom), desenfoque del fondo,
// mapeo de tonos filmico (ACES), viñeta y un poco de grano.

const QUAD_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p; gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0);
}`;

// Reducción a la mitad con 4 muestras bilineales (13 píxeles efectivos).
const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel;
out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv + uTexel*vec2(-1.0, -1.0)).rgb + texture(uTex, vUv + uTexel*vec2(1.0, -1.0)).rgb
         + texture(uTex, vUv + uTexel*vec2(-1.0, 1.0)).rgb + texture(uTex, vUv + uTexel*vec2(1.0, 1.0)).rgb;
  o = vec4(min(c*0.25, vec3(24.0)), 1.0);
}`;

// Desenfoque gaussiano separable de 9 píxeles con 5 lecturas.
const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb*0.227027;
  c += (texture(uTex, vUv + uDir*1.3846).rgb + texture(uTex, vUv - uDir*1.3846).rgb)*0.316216;
  c += (texture(uTex, vUv + uDir*3.2308).rgb + texture(uTex, vUv - uDir*3.2308).rgb)*0.070270;
  o = vec4(c, 1.0);
}`;

// Oclusión ambiental en pantalla, a media resolución: compara la profundidad
// de cada punto con la de sus vecinos (los rincones reciben menos luz).
const AO_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDepth;
uniform vec4 uProjInfo;  // x = cerca, y = lejos, z = tan(fov/2)*aspecto, w = tan(fov/2)
uniform vec2 uRadius;    // x = radio en unidades del mundo, y = alto en píxeles
out vec4 o;
float lin(float z){ return (2.0*uProjInfo.x*uProjInfo.y)/(uProjInfo.y + uProjInfo.x - (z*2.0 - 1.0)*(uProjInfo.y - uProjInfo.x)); }
vec3 posAt(vec2 uv){
  float d = lin(texture(uDepth, uv).r);
  return vec3((uv*2.0 - 1.0)*uProjInfo.zw*d, -d);
}
void main(){
  float z = texture(uDepth, vUv).r;
  if (z >= 0.9999) { o = vec4(1.0); return; }
  vec3 P = posAt(vUv);
  vec3 N = normalize(cross(dFdx(P), dFdy(P)));
  float rScreen = clamp(uRadius.x/(-P.z*uProjInfo.w*2.0), 0.004, 0.12);
  float ang = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))*6.2831853;
  float occ = 0.0;
  for (int i = 0; i < 10; i++) {
    float t = (float(i) + 0.5)/10.0;
    float a = ang + float(i)*2.399963;
    vec2 off = vec2(cos(a), sin(a))*rScreen*sqrt(t);
    off.x *= uProjInfo.w/uProjInfo.z;
    vec3 S = posAt(vUv + off) - P;
    float d2 = dot(S, S);
    float nd = dot(S, N)/sqrt(d2 + 1e-5);
    occ += max(0.0, nd - 0.12)*smoothstep(uRadius.x*uRadius.x*1.4, 0.0, d2)*1.35;
  }
  o = vec4(vec3(clamp(1.0 - occ/10.0*2.3, 0.0, 1.0)), 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene, uQ, uE, uDepth, uAo;
uniform vec4 uProjInfo;
uniform vec4 uFocus;   // x = desde, y = hasta (profundidad), z = fuerza del desenfoque, w = oclusión
uniform vec4 uGrade;   // x = umbral del resplandor, y = fuerza, z = viñeta, w = grano
uniform vec4 uGrade2;  // x = saturación, y = contraste, z = semilla del grano
uniform vec3 uTint;
out vec4 o;
vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float lin(float z){ return (2.0*uProjInfo.x*uProjInfo.y)/(uProjInfo.y + uProjInfo.x - (z*2.0 - 1.0)*(uProjInfo.y - uProjInfo.x)); }
void main(){
  vec3 c = texture(uScene, vUv).rgb;
  vec3 q = texture(uQ, vUv).rgb;
  vec3 e = texture(uE, vUv).rgb;
  float z = texture(uDepth, vUv).r;
  float d = lin(z);
  if (uFocus.w > 0.0) {
    // Oclusión suavizada (4 lecturas bilineales sobre el mapa a media resolución).
    vec2 tx = 1.0/vec2(textureSize(uAo, 0));
    float ao = (texture(uAo, vUv + tx*vec2(-0.75, -0.75)).r + texture(uAo, vUv + tx*vec2(0.75, -0.75)).r
              + texture(uAo, vUv + tx*vec2(-0.75, 0.75)).r + texture(uAo, vUv + tx*vec2(0.75, 0.75)).r)*0.25;
    c *= mix(1.0, ao, uFocus.w*(1.0 - smoothstep(uFocus.x, uFocus.y, d)));
  }
  // Fondo desenfocado, como con una cámara de verdad.
  float coc = smoothstep(uFocus.x, uFocus.y, d)*uFocus.z;
  c = mix(c, mix(q, e, 0.35), coc);
  // Resplandor: lo muy brillante se desborda un poco.
  vec3 glow = max(q*0.55 + e*0.45 - uGrade.x, 0.0);
  c += glow*uGrade.y;
  c = aces(c*uTint);
  c = pow(c, vec3(1.0/2.2));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uGrade2.x);
  c = (c - 0.5)*uGrade2.y + 0.5;
  vec2 v = (vUv - 0.5)*vec2(1.0, 0.82);
  c *= 1.0 - uGrade.z*smoothstep(0.32, 0.9, length(v)*1.45);
  float n = fract(sin(dot(gl_FragCoord.xy + uGrade2.z, vec2(12.9898, 78.233)))*43758.5453);
  c += (n - 0.5)*uGrade.w;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/**
 * Crea la cadena de posproceso, o devuelve null si la tarjeta gráfica no
 * puede dibujar en texturas de coma flotante (entonces se dibuja directo).
 */
export function createPost(gl, compile) {
  const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  if (!ext) return null;
  let down; let blur; let aoProg; let final;
  try {
    down = compile(gl, QUAD_VS, DOWN_FS);
    blur = compile(gl, QUAD_VS, BLUR_FS);
    aoProg = compile(gl, QUAD_VS, AO_FS);
    final = compile(gl, QUAD_VS, FINAL_FS);
  } catch { return null; }
  const vao = gl.createVertexArray();
  let W = 0; let H = 0;
  let ms = null; let scene = null; let levels = []; let ao = null;
  let broken = false;

  const colorTex = (w, h, fmt = gl.RGBA16F) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const target = (w, h, fmt) => {
    const tex = colorTex(w, h, fmt);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  };
  function free() {
    if (ms) { gl.deleteFramebuffer(ms.fb); gl.deleteRenderbuffer(ms.color); gl.deleteRenderbuffer(ms.depth); }
    if (scene) { gl.deleteFramebuffer(scene.fb); gl.deleteTexture(scene.tex); gl.deleteTexture(scene.depth); }
    for (const l of levels) { gl.deleteFramebuffer(l.fb); gl.deleteTexture(l.tex); }
    if (ao) { gl.deleteFramebuffer(ao.fb); gl.deleteTexture(ao.tex); }
    ms = null; scene = null; levels = []; ao = null;
  }
  function resize(w, h) {
    if (w === W && h === H && ms) return true;
    free();
    W = w; H = h;
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    ms = { fb: gl.createFramebuffer(), color: gl.createRenderbuffer(), depth: gl.createRenderbuffer() };
    gl.bindRenderbuffer(gl.RENDERBUFFER, ms.color);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, ms.depth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms.fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, ms.color);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ms.depth);
    const okMs = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    scene = target(w, h);
    scene.depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, scene.depth);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, scene.depth, 0);
    const okScene = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    const half = [Math.max(2, w >> 1), Math.max(2, h >> 1)];
    const qtr = [Math.max(2, w >> 2), Math.max(2, h >> 2)];
    const eig = [Math.max(2, w >> 3), Math.max(2, h >> 3)];
    // mitad · cuarto (A y B para el desenfoque) · octavo (A y B)
    levels = [target(...half), target(...qtr), target(...qtr), target(...eig), target(...eig)];
    ao = target(half[0], half[1], gl.R8);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    broken = !(okMs && okScene);
    return !broken;
  }

  /** Empieza un cuadro: lo que se dibuje a partir de aquí va al búfer HDR. */
  function begin(w, h) {
    if (!resize(w, h)) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms.fb);
    gl.viewport(0, 0, W, H);
    return true;
  }

  const pass = (prog, dst, bind) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null);
    gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
    gl.useProgram(prog.p);
    bind(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const tex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };

  /**
   * Termina el cuadro y lo compone en el lienzo.
   * p = { near, far, tanX, tanY, focus:[desde, hasta, fuerza], ao, aoRadius, bloom:[umbral, fuerza], vignette, grain, tint, seed }
   */
  function end(p) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, ms.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, scene.fb);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    gl.bindVertexArray(vao);
    const [half, qA, qB, eA, eB] = levels;
    pass(down, half, (u) => { tex(0, scene.tex, u.uTex); gl.uniform2f(u.uTexel, 0.5 / W, 0.5 / H); });
    pass(down, qA, (u) => { tex(0, half.tex, u.uTex); gl.uniform2f(u.uTexel, 0.5 / half.w, 0.5 / half.h); });
    pass(blur, qB, (u) => { tex(0, qA.tex, u.uTex); gl.uniform2f(u.uDir, 1 / qA.w, 0); });
    pass(blur, qA, (u) => { tex(0, qB.tex, u.uTex); gl.uniform2f(u.uDir, 0, 1 / qA.h); });
    pass(down, eA, (u) => { tex(0, qA.tex, u.uTex); gl.uniform2f(u.uTexel, 0.5 / qA.w, 0.5 / qA.h); });
    pass(blur, eB, (u) => { tex(0, eA.tex, u.uTex); gl.uniform2f(u.uDir, 1 / eA.w, 0); });
    pass(blur, eA, (u) => { tex(0, eB.tex, u.uTex); gl.uniform2f(u.uDir, 0, 1 / eA.h); });
    const proj = [p.near, p.far, p.tanX, p.tanY];
    if (p.ao > 0) {
      pass(aoProg, ao, (u) => {
        tex(0, scene.depth, u.uDepth);
        gl.uniform4fv(u.uProjInfo, proj);
        gl.uniform2f(u.uRadius, p.aoRadius, H);
      });
    }
    pass(final, null, (u) => {
      tex(0, scene.tex, u.uScene); tex(1, qA.tex, u.uQ); tex(2, eA.tex, u.uE); tex(3, scene.depth, u.uDepth); tex(4, ao.tex, u.uAo);
      gl.uniform4fv(u.uProjInfo, proj);
      gl.uniform4f(u.uFocus, p.focus[0], p.focus[1], p.focus[2], p.ao || 0);
      gl.uniform4f(u.uGrade, p.bloom[0], p.bloom[1], p.vignette ?? 0.3, p.grain ?? 0.014);
      gl.uniform4f(u.uGrade2, p.saturation ?? 1.06, p.contrast ?? 1.04, p.seed || 0, 0);
      gl.uniform3fv(u.uTint, p.tint || [1, 1, 1]);
    });
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  return { begin, end, free, get broken() { return broken; } };
}
