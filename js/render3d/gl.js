// Motor WebGL2 mínimo para los dinosaurios (sin librerías).
// Luz de estudio: luz principal cálida con sombras suaves (PCF), luz de
// contorno fría desde atrás, cielo/suelo como luz ambiente, aproximación de
// dispersión subsuperficial (iluminación "envolvente", GPU Gems cap. 16),
// relieve de escamas por derivadas, membranas translúcidas, capas de plumas
// y mapeo de tonos filmico (ACES, aproximación de Narkowicz).

import { skinDetail, strandNoise, irisTexture, bodyTexture, headTexture, cssToRgb, natural } from './textures.js';
import { parsePath } from './model.js';

// ------------------------------------------------------------ matemáticas
export const m4 = {
  ident: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  },
  persp(fov, aspect, n, f) {
    const t = 1 / Math.tan(fov / 2);
    return [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
  },
  ortho(l, r, b, t, n, f) {
    return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1];
  },
  lookAt(eye, at, up) {
    const z = norm3(sub3(eye, at));
    const x = norm3(cross3(up, z));
    const y = cross3(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1];
  },
  translate: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  rotY(a) { const c = Math.cos(a); const s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  apply(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w, (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w];
  },
};
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

const toLin = (rgb) => rgb.map((c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });

// ------------------------------------------------------------ sombreadores
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aRig;
uniform mat4 uModel, uView, uProj, uLightVP;
uniform vec4 uJaw, uWalk;
uniform vec4 uLegA[4];
uniform vec4 uLegB[4];
uniform float uTime;
uniform vec4 uTail, uBody, uNeck, uNeck2, uFlap;
uniform float uFlapSide, uShell, uShadowOff;
uniform vec4 uShellU;
uniform vec3 uShellDir;
uniform int uLid;
uniform vec3 uLidC, uLidX, uLidY, uLidZ;
uniform float uLidR, uLidPhi, uLidTilt;
out vec3 vWorld; out vec3 vNormal; out vec2 vUv; out vec4 vCol; out vec4 vLight; out float vFur;
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
vec3 rotZ(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x-s*p.y, s*p.x+c*p.y, p.z); }
// Gira un punto (y su normal) en el plano lateral alrededor de una articulación.
void joint(inout vec3 p, inout vec3 n, vec2 piv, float a){
  float c = cos(a), s = sin(a);
  vec2 q = p.xy - piv;
  p.xy = piv + vec2(c*q.x - s*q.y, s*q.x + c*q.y);
  n.xy = vec2(c*n.x - s*n.y, s*n.x + c*n.y);
}
void main(){
  vec3 p = aPos; vec3 n = aNor;
  if (uLid == 1) {
    float phi = aUv.x * uLidPhi; float th = aUv.y * 6.2831853;
    vec3 d = vec3(sin(phi)*cos(th), cos(phi), sin(phi)*sin(th));
    float c = cos(uLidTilt), s = sin(uLidTilt);
    d = vec3(c*d.x - s*d.y, s*d.x + c*d.y, d.z);
    n = normalize(uLidX*d.x + uLidY*d.y + uLidZ*d.z);
    p = uLidC + n * uLidR;
  }
  // Mandíbula: los vértices de abajo de la boca giran en la articulación.
  if (aRig.z > 0.0 && uJaw.z != 0.0) joint(p, n, uJaw.xy, -uJaw.z*aRig.z);
  // Paso: cada pata gira en la cadera, la rodilla y el tobillo, del extremo
  // hacia el cuerpo. Avanza en el aire con la rodilla doblada y empuja recta.
  if (aRig.x > 0.5 && uWalk.y > 0.0) {
    int li = int(aRig.x + 0.5) - 1;
    vec4 A = uLegA[li]; vec4 B = uLegB[li];
    float ph = uWalk.x + B.z;
    float sw = sin(ph); float lift = max(0.0, cos(ph));
    joint(p, n, B.xy, lift*0.6*uWalk.w*B.w*uWalk.y*clamp(aRig.y - 2.0, 0.0, 1.0));
    joint(p, n, A.zw, -lift*0.9*uWalk.w*B.w*uWalk.y*clamp(aRig.y - 1.0, 0.0, 1.0));
    joint(p, n, A.xy, (sw*uWalk.z + lift*0.1*B.w)*uWalk.y*clamp(aRig.y, 0.0, 1.0));
  }
  // Cola que se balancea
  float tt = clamp((uTail.x - p.x) / max(1.0, uTail.x - uTail.y), 0.0, 1.0);
  p.z += sin(uTime*1.25 - tt*2.6) * uTail.z * tt * tt;
  // Respiración
  float bw = smoothstep(uBody.x, mix(uBody.x, uBody.y, 0.45), p.x) * (1.0 - smoothstep(mix(uBody.x, uBody.y, 0.55), uBody.y, p.x));
  float br = (0.5 + 0.5*sin(uTime*1.6)) * uBody.w * bw;
  p.y += (p.y - uBody.z) * br; p.z *= 1.0 + br;
  // Cuello y cabeza
  float nw = smoothstep(uNeck.x, uNeck.z, p.x);
  if (nw > 0.0) {
    vec3 piv = vec3(uNeck.x, uNeck.y, 0.0);
    vec3 q = rotY(rotZ(p - piv, uNeck2.x*nw), uNeck.w*nw);
    p = piv + q;
    n = rotY(rotZ(n, uNeck2.x*nw), uNeck.w*nw);
  }
  // Aleteo (pterosaurios)
  if (uFlapSide != 0.0) {
    float w = smoothstep(uFlap.x, uFlap.x + 8.0, abs(p.z));
    float a = sin(uTime*2.1) * uFlap.z * uFlapSide * w;
    float yy = p.y - uFlap.y; float zz = p.z - uFlap.x*uFlapSide;
    float c = cos(a), s = sin(a);
    p.y = uFlap.y + c*yy + s*zz; p.z = uFlap.x*uFlapSide - s*yy + c*zz;
    float ny = c*n.y + s*n.z; float nz = -s*n.y + c*n.z; n.y = ny; n.z = nz;
  }
  // Capas de plumas: crecen por la normal y se peinan hacia atrás
  vFur = 1.0;
  if (uShell > 0.0) {
    // Sin plumón en las puntas (cola y cuello), para no formar "agujas".
    float ff = smoothstep(uShellU.x, uShellU.y, aUv.x) * (1.0 - smoothstep(uShellU.z, uShellU.w, aUv.x));
    p += (n*uShell + uShellDir*uShell*uShell*0.35) * ff;
    vFur = ff;
  }
  vec4 wp = uModel * vec4(p, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(uModel) * n);
  vUv = aUv; vCol = aCol;
  vLight = uLightVP * vec4(wp.xyz + vNormal * uShadowOff, 1.0);
  gl_Position = uProj * uView * wp;
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in vec4 vCol; in vec4 vLight; in float vFur;
uniform vec3 uColor;
uniform sampler2D uMap; uniform float uUseMap;
uniform sampler2D uBump; uniform float uBumpScale; uniform vec2 uBumpRep, uBumpRep2;
uniform vec3 uBumpMix; uniform float uMacro, uCav, uRing;
uniform sampler2D uStrand; uniform float uShellT; uniform vec2 uStrandRep;
uniform sampler2DShadow uShadow; uniform float uUseShadow;
uniform vec3 uCam, uKeyDir, uKeyCol, uRimDir, uRimCol, uSky, uGround;
uniform float uRough, uSpec, uSSS, uTrans, uMetal, uEmis, uIrid, uExposure, uFlat;
uniform vec3 uFlatCol;
out vec4 outColor;
float shadowAt(vec4 lp){
  vec3 p = lp.xyz/lp.w*0.5+0.5;
  if (p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0||p.z>1.0) return 1.0;
  vec2 tx = 1.0/vec2(textureSize(uShadow,0));
  float s = 0.0;
  for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++) s += texture(uShadow, vec3(p.xy + vec2(float(i),float(j))*tx*1.2, p.z - 0.0018));
  return s/25.0;
}
vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
vec2 gdx, gdy;
float fineH;
// Altura de la piel en un punto: escamas finas + escamas grandes + arrugas
// (mosaico) + relieve anatómico del propio animal (alfa de su textura).
float skinH(vec2 o){
  vec2 uv = vUv + o;
  vec4 a = textureGrad(uBump, uv*uBumpRep, gdx*uBumpRep, gdy*uBumpRep);
  vec4 b = textureGrad(uBump, uv*uBumpRep2 + vec2(0.37, 0.0), gdx*uBumpRep2, gdy*uBumpRep2);
  fineH = a.r;
  float h = a.r*uBumpMix.x + b.b*uBumpMix.y + b.g*uBumpMix.z;
  // Pliegues en anillo de las patas (como los de un elefante), a parches.
  if (uRing > 0.0) h += uRing*smoothstep(0.25, 0.7, b.b)*(sqrt(abs(sin(3.14159*(uv.x*5.2 + a.g*1.4)))) - 0.6);
  if (uMacro > 0.0) h += textureGrad(uMap, uv, gdx, gdy).a*uMacro;
  return h;
}
vec3 bumpN(vec3 N, float h0){
  float hx = skinH(gdx) - h0;
  float hy = skinH(gdy) - h0;
  vec3 sx = dFdx(vWorld), sy = dFdy(vWorld);
  vec3 r1 = cross(sy, N), r2 = cross(N, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det)*(hx*uBumpScale*r1 + hy*uBumpScale*r2);
  return normalize(abs(det)*N - g);
}
void main(){
  if (uFlat > 0.5) { outColor = vec4(uFlatCol, 1.0); return; }
  // Derivadas sin costura (Tarini): en la unión de la textura v salta de 1 a 0.
  gdx = dFdx(vUv); gdy = dFdy(vUv);
  vec2 alt = vec2(vUv.x, fract(vUv.y + 0.5));
  vec2 ax = dFdx(alt), ay = dFdy(alt);
  if (abs(ax.y) + abs(ay.y) < abs(gdx.y) + abs(gdy.y)) { gdx = ax; gdy = ay; }
  vec3 base = uColor * vCol.rgb;
  if (uUseMap > 0.5) base *= textureGrad(uMap, vUv, gdx, gdy).rgb;
  if (uShellT > 0.0) {
    float s = textureGrad(uStrand, vUv*uStrandRep, gdx*uStrandRep, gdy*uStrandRep).r;
    if (s < uShellT || vFur < 0.04) discard;
    base *= mix(0.62, 1.1, uShellT);
  }
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  float cav = 1.0;
  if (uBumpScale > 0.0) {
    float h0 = skinH(vec2(0.0));
    // Entre escama y escama la piel es más oscura y mate.
    cav = smoothstep(0.08, 0.62, fineH);
    base *= mix(1.0 - uCav, 1.0 + uCav*0.3, cav);
    N = bumpN(N, h0);
  }
  vec3 V = normalize(uCam - vWorld);
  vec3 L = normalize(uKeyDir);
  float ndl = dot(N, L);
  float w = uSSS;
  float diff = max(0.0, (ndl + w)/(1.0 + w));
  float sss = smoothstep(-w, 0.25, ndl) * (1.0 - smoothstep(0.25, 0.85, ndl)) * w;
  float sh = uUseShadow > 0.5 ? shadowAt(vLight) : 1.0;
  sh = mix(1.0, sh, 0.85);
  vec3 H = normalize(L + V);
  float a = max(0.03, uRough*uRough);
  float ndh = max(dot(N, H), 0.0);
  float dd = ndh*ndh*(a*a - 1.0) + 1.0;
  float D = a*a/(3.14159*dd*dd);
  float F = 0.04 + 0.96*pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = D*F*0.25*uSpec*max(ndl, 0.0)*mix(0.45, 1.15, cav);
  vec3 sc = mix(vec3(1.0), base, uMetal);
  vec3 col = base*(1.0 - uMetal*0.85)*uKeyCol*(diff*sh) + base*uKeyCol*sss*vec3(1.0, 0.42, 0.3)*0.55;
  col += sc*uKeyCol*spec*sh;
  float hem = N.y*0.5 + 0.5;
  // La luz ambiente también llega menos donde el cuerpo se hace sombra.
  col += base*mix(uGround, uSky, hem)*vCol.a*(1.0 - uMetal*0.6)*mix(0.72, 1.0, sh);
  if (uMetal > 0.0) { vec3 R = reflect(-V, N); col += base*mix(uGround*2.0, uSky*2.6, R.y*0.5+0.5)*uMetal*0.55; }
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float rimL = max(0.0, dot(N, normalize(uRimDir))*0.75 + 0.25);
  col += uRimCol*fres*rimL*(0.25 + 0.75*base)*(0.6 + 0.4*vCol.a);
  if (uTrans > 0.0) {
    col += base*uKeyCol*max(0.0, -ndl)*uTrans*0.55*vec3(1.0, 0.78, 0.6);
    col += base*uRimCol*pow(max(0.0, dot(V, -normalize(uRimDir))), 2.0)*uTrans*0.7;
  }
  if (uIrid > 0.0) {
    float t = 1.0 - max(dot(N, V), 0.0);
    vec3 ir = 0.5 + 0.5*cos(6.2831*(t*1.3 + vec3(0.0, 0.33, 0.67)));
    col = mix(col, col*ir*1.7, uIrid*(0.35 + 0.65*t));
  }
  col += base*uEmis;
  col = aces(col*uExposure);
  outColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
}`;

const GROUND_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uView, uProj, uLightVP;
out vec3 vWorld; out vec4 vLight;
void main(){ vWorld = aPos; vLight = uLightVP*vec4(aPos,1.0); gl_Position = uProj*uView*vec4(aPos,1.0); }`;

const GROUND_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld; in vec4 vLight;
uniform sampler2DShadow uShadow; uniform float uUseShadow;
uniform vec4 uBlob; uniform vec2 uOpacity; uniform vec3 uCenter; uniform float uRadius;
out vec4 outColor;
float shadowAt(vec4 lp){
  vec3 p = lp.xyz/lp.w*0.5+0.5;
  if (p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0||p.z>1.0) return 1.0;
  vec2 tx = 1.0/vec2(textureSize(uShadow,0));
  float s = 0.0;
  for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++) s += texture(uShadow, vec3(p.xy + vec2(float(i),float(j))*tx*1.6, p.z - 0.002));
  return s/25.0;
}
void main(){
  float sh = uUseShadow > 0.5 ? 1.0 - shadowAt(vLight) : 0.0;
  vec2 d = (vWorld.xz - uBlob.xy)/uBlob.zw;
  float ao = exp(-dot(d, d)*2.0);
  float fade = 1.0 - smoothstep(uRadius*0.55, uRadius*1.0, length(vWorld.xz - uCenter.xz));
  float a = clamp(sh*uOpacity.x + ao*uOpacity.y, 0.0, 0.8)*fade;
  outColor = vec4(0.0, 0.0, 0.0, a);
}`;

const DEPTH_FS = `#version 300 es
precision highp float;
out vec4 o; void main(){ o = vec4(1.0); }`;

function compile(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i += 1) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

// ------------------------------------------------------------ materiales
// bump = [escamas finas, escamas grandes, arrugas]; macro = relieve anatómico
// de la textura del animal; cav = cuánto se oscurece entre escamas.
const MATS = {
  body: { map: 'body', rough: 0.6, spec: 0.5, sss: 0.42, bump: [0.55, 0.5, 0.75], macro: 1.5, cav: 0.2, rep: 'body' },
  head: { map: 'head', rough: 0.55, spec: 0.55, sss: 0.4, bump: [0.5, 0.35, 0.5], macro: 1.2, cav: 0.18, rep: 'head' },
  skin: { color: 'piel', rough: 0.58, spec: 0.5, sss: 0.4, bump: [0.5, 0.3, 0.4], cav: 0.16, rep: 'patch' },
  limb: { color: 'piel', rough: 0.64, spec: 0.45, sss: 0.38, bump: [0.5, 0.3, 0.25], ring: 0.45, cav: 0.16, rep: 'limb' },
  limbFar: { color: 'pielFar', rough: 0.64, spec: 0.4, sss: 0.38, bump: [0.5, 0.3, 0.25], ring: 0.45, cav: 0.16, rep: 'limb' },
  shade: { color: 'sombra', rough: 0.55, spec: 0.5, sss: 0.25, bump: [0.3, 0.3, 0.5], cav: 0.15, rep: [2, 2] },
  accent: { color: 'acento', rough: 0.5, spec: 0.45, sss: 0.45, trans: 0.3, bump: [0.2, 0.2, 0.4], cav: 0.1, rep: [5, 5] },
  frill: { color: 'acento', rough: 0.6, spec: 0.4, sss: 0.45, trans: 0.12, bump: [0.5, 0.4, 0.6], cav: 0.2, rep: [5, 4], double: true },
  plate: { color: 'acento', rough: 0.45, spec: 0.5, sss: 0.5, trans: 0.55, bump: [0.1, 0.25, 0.6], cav: 0.1, rep: [3, 3] },
  membrane: { color: 'acento', rough: 0.55, spec: 0.35, sss: 0.55, trans: 0.95, bump: [0, 0.1, 0.5], cav: 0.06, rep: [6, 3], double: true },
  feather: { color: 'acento', rough: 0.8, spec: 0.2, sss: 0.3, double: true },
  wing: { color: 'piel', rough: 0.75, spec: 0.25, sss: 0.35, trans: 0.2, double: true },
  keratin: { color: '#ddd0b6', rough: 0.3, spec: 0.8, sss: 0.15 },
  claw: { color: '#5d4f40', rough: 0.28, spec: 0.9, sss: 0.05 },
  mouth: { color: '#8e3a3c', rough: 0.3, spec: 0.7, sss: 0.5, double: true },
  tongue: { color: '#c9606a', rough: 0.28, spec: 0.8, sss: 0.6 },
  tooth: { color: '#efe6cf', rough: 0.25, spec: 0.9, sss: 0.2 },
  eye: { map: 'iris', rough: 0.07, spec: 2.4, sss: 0 },
  lid: { color: 'piel', rough: 0.55, spec: 0.4, sss: 0.35, double: true },
};

function makeTex(gl, img, { srgb = true, wrapU = gl.REPEAT, wrapV = gl.REPEAT, mip = true } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, img.w, img.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapU);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapV);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  const an = gl.getExtension('EXT_texture_filter_anisotropic');
  if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  return t;
}

// ------------------------------------------------------------ renderizador

export function createRenderer(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'low-power',
  });
  if (!gl) return null;
  const lit = compile(gl, VS, FS);
  const depth = compile(gl, VS, DEPTH_FS);
  const ground = compile(gl, GROUND_VS, GROUND_FS);
  const bumpTex = makeTex(gl, skinDetail(256), { srgb: false });
  const strandTex = makeTex(gl, strandNoise(64), { srgb: false, mip: false });
  gl.bindTexture(gl.TEXTURE_2D, strandTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Mapa de sombras
  const SM = opts.shadowSize || 1024;
  const shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SM, SM);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const shadowFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const groundVao = gl.createVertexArray();
  const groundBuf = gl.createBuffer();
  gl.bindVertexArray(groundVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, groundBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /** Sube un modelo a la GPU: agrupa las piezas por material para dibujar poco. */
  function upload(model, uo = {}) {
    const ts = uo.texScale || 1;
    const c = model.colors;
    const rgb = {
      piel: natural(cssToRgb(c.piel)), sombra: natural(cssToRgb(c.sombra), 0.6, 0.9), acento: natural(cssToRgb(c.acento), 0.86, 0.98),
    };
    rgb.pielFar = rgb.piel.map((v, i) => v * 0.82 + rgb.sombra[i] * 0.18);
    const info = model.info;
    const tex = {
      body: makeTex(gl, bodyTexture(model, { countershade: !!model.countershade, w: 512 * ts, h: 256 * ts }), { wrapU: gl.CLAMP_TO_EDGE }),
      head: makeTex(gl, headTexture(model, parsePath(info.head.jaw, 8), { w: 256 * ts, h: 128 * ts }), { wrapU: gl.CLAMP_TO_EDGE }),
      iris: makeTex(gl, irisTexture(c.ojo === '#1f1a14' ? `hsl(${36 + ((model.genes?.hue2 || 0) % 22)} 72% 40%)` : c.ojo), { wrapU: gl.CLAMP_TO_EDGE, wrapV: gl.CLAMP_TO_EDGE }),
    };
    const lastBody = info.bodyMap[info.bodyMap.length - 1];
    const avgGirth = info.bodyMap.reduce((a, m) => a + m.girth, 0) / info.bodyMap.length;
    // Cada mosaico de detalle tiene 14 × 14 escamas finas; `skinScale` las
    // hace más pequeñas en los animales grandes, como en la realidad.
    const tile = (info.skinScale || 1) * 14;
    const headLen = (info.head.x1 - info.head.x0) * info.headScale;
    const reps = {
      body: [Math.max(2, lastBody.s / tile), Math.max(2, avgGirth / tile)],
      head: [Math.max(1, headLen / (tile * 0.8)), Math.max(2, (headLen * 1.6) / (tile * 0.8))],
      // Las patas traen sus uv ya medidas en mosaicos (tube con uvUnit).
      limb: [1, 1],
      patch: [2, 2],
    };
    const groups = new Map();
    const lids = [];
    for (const part of model.parts) {
      if (part.lid) { lids.push(part); continue; }
      const key = [part.mat, part.double ? 'd' : '', part.shells ? 's' : '', part.flap || 0, part.color || '', part.rough ?? '', part.metal ?? '', part.emissive ?? ''].join('|');
      if (!groups.has(key)) groups.set(key, { meshes: [], part });
      groups.get(key).meshes.push(part.mesh);
    }
    const draws = [];
    const mk = (meshes, part) => {
      const pos = []; const nor = []; const uv = []; const col = []; const rig = []; const idx = [];
      let off = 0;
      for (const m of meshes) {
        pos.push(...m.pos); nor.push(...m.nor); uv.push(...m.uv); col.push(...m.col);
        if (m.rig) rig.push(...m.rig); else for (let i = 0; i < m.count * 4; i += 1) rig.push(0);
        for (const i of m.idx) idx.push(i + off);
        off += m.count;
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const bufs = [];
      [[pos, 3], [nor, 3], [uv, 2], [col, 4], [rig, 4]].forEach(([arr, n], loc) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
        bufs.push(b);
      });
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
      bufs.push(ib);
      gl.bindVertexArray(null);
      const base = MATS[part.mat] || {};
      const mat = { ...base };
      if (part.double) mat.double = true;
      if (part.mat === 'acc') Object.assign(mat, { color: part.color, rough: part.rough ?? 0.5, spec: part.metal ? 1.4 : 0.6, metal: part.metal || 0, emis: part.emissive || 0, sss: 0.1 });
      const colr = mat.color ? (mat.color[0] === '#' ? cssToRgb(mat.color) : rgb[mat.color]) : [255, 255, 255];
      mat.lin = toLin(colr);
      const rp = Array.isArray(mat.rep) ? mat.rep : reps[mat.rep] || [4, 4];
      // Alrededor del cuerpo (v) las repeticiones son enteras para que el
      // mosaico cierre; en las patas la uv ya viene en vueltas enteras.
      const whole = (x) => Math.max(1, Math.round(x));
      mat.rep2 = [rp[0], whole(rp[1])];
      // Segunda capa (escamas grandes y arrugas) a un tercio de la escala; en
      // las patas no hay vueltas enteras que aprovechar y se usa la misma.
      mat.rep3 = mat.rep === 'limb' ? mat.rep2 : [rp[0] * 0.29, whole(rp[1] * 0.29)];
      return { vao, bufs, count: idx.length, mat, part };
    };
    for (const { meshes, part } of groups.values()) draws.push(mk(meshes, part));
    for (const l of lids) draws.push(mk([l.mesh], l));
    // Puntos de muestra para encuadrar (un vértice de cada cuatro).
    const sample = [];
    for (const p of model.parts) {
      if (p.lid) continue;
      for (let i = 0; i < p.mesh.pos.length; i += 12) sample.push([p.mesh.pos[i], p.mesh.pos[i + 1], p.mesh.pos[i + 2]]);
    }
    return { draws, tex, info, anim: model.anim, sample, bounds: info.bounds, silColor: [59, 58, 53], irid: model.iridescent ? 0.55 : 0 };
  }

  function dispose(scene) {
    for (const d of scene.draws) {
      gl.deleteVertexArray(d.vao);
      for (const b of d.bufs) gl.deleteBuffer(b);
    }
    for (const t of Object.values(scene.tex)) gl.deleteTexture(t);
  }

  const light = {
    key: norm3([0.42, 0.85, 0.55]),
    keyCol: [1.95, 1.82, 1.64],
    rim: norm3([-0.55, 0.45, -0.75]),
    rimCol: [0.95, 1.1, 1.45],
    sky: [0.5, 0.58, 0.74],
    ground: [0.33, 0.28, 0.21],
  };

  function setCommon(prog, model, cam, lightVP, a) {
    const u = prog.u;
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniformMatrix4fv(u.uView, false, cam.view);
    gl.uniformMatrix4fv(u.uProj, false, cam.proj);
    if (u.uLightVP) gl.uniformMatrix4fv(u.uLightVP, false, lightVP);
    gl.uniform1f(u.uTime, a.time || 0);
    gl.uniform4fv(u.uTail, [a.tail[0], a.tail[1], a.tail[2] * (a.sway ?? 0), 0]);
    gl.uniform4fv(u.uBody, [a.body[0], a.body[1], a.body[2], a.body[3] * (a.breath ?? 0)]);
    gl.uniform4fv(u.uNeck, [a.neck[0], a.neck[1], a.neck[2], a.yaw || 0]);
    gl.uniform4fv(u.uNeck2, [a.pitch || 0, 0, 0, 0]);
    gl.uniform4fv(u.uFlap, [a.flap[0], a.flap[1], a.flap[2] * (a.flapAmt ?? 0), a.flap[3]]);
    gl.uniform1f(u.uShadowOff, a.shadowOff ?? Math.max(0.4, (a.radius || 60) * 0.012));
    const jaw = a.jaw || [0, 0];
    gl.uniform4fv(u.uJaw, [jaw[0], jaw[1], a.jawOpen || 0, 0]);
    const legs = a.legs || [];
    const walkAmt = legs.length ? (a.walkAmt || 0) : 0;
    gl.uniform4fv(u.uWalk, [a.walk || 0, walkAmt, a.stride || 0.4, a.bend ?? 1]);
    if (walkAmt > 0 && u['uLegA[0]']) {
      const A = new Float32Array(16); const B = new Float32Array(16);
      legs.slice(0, 4).forEach((l, i) => { A.set([l.hip[0], l.hip[1], l.knee[0], l.knee[1]], i * 4); B.set([l.ankle[0], l.ankle[1], l.phase, l.bend], i * 4); });
      gl.uniform4fv(u['uLegA[0]'], A);
      gl.uniform4fv(u['uLegB[0]'], B);
    }
  }

  function drawPart(prog, d, scene, a, pass) {
    const u = prog.u;
    gl.uniform1f(u.uFlapSide, d.part.flap || 0);
    if (d.part.lid) {
      const l = d.part.lid;
      gl.uniform1i(u.uLid, 1);
      gl.uniform3fv(u.uLidC, l.c); gl.uniform3fv(u.uLidX, l.X); gl.uniform3fv(u.uLidY, l.lower ? l.Y.map((v) => -v) : l.Y); gl.uniform3fv(u.uLidZ, l.Z);
      gl.uniform1f(u.uLidR, l.r);
      const blink = l.lower ? 0 : (a.blink || 0);
      gl.uniform1f(u.uLidPhi, Math.PI * Math.min(1, l.amount + (1 - l.amount) * blink) * (l.lower ? 0.9 : 1));
      gl.uniform1f(u.uLidTilt, l.tilt || 0);
    } else gl.uniform1i(u.uLid, 0);
    gl.uniform1f(u.uShell, 0);
    if (pass === 'depth') {
      if (d.mat.double || d.part.lid) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(d.vao);
      gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
      return;
    }
    const m = d.mat;
    gl.uniform3fv(u.uColor, m.lin);
    gl.uniform1f(u.uUseMap, m.map ? 1 : 0);
    if (m.map) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.tex[m.map]);
      gl.uniform1i(u.uMap, 0);
    }
    gl.uniform1f(u.uBumpScale, m.bump ? (a.bumpScale ?? 1) : 0);
    gl.uniform3fv(u.uBumpMix, m.bump || [0, 0, 0]);
    gl.uniform1f(u.uMacro, m.map && m.macro ? m.macro : 0);
    gl.uniform1f(u.uCav, m.cav || 0);
    gl.uniform1f(u.uRing, m.ring || 0);
    gl.uniform2fv(u.uBumpRep, m.rep2);
    gl.uniform2fv(u.uBumpRep2, m.rep3);
    gl.uniform1f(u.uRough, m.rough ?? 0.6);
    gl.uniform1f(u.uSpec, m.spec ?? 0.4);
    gl.uniform1f(u.uSSS, m.sss ?? 0.3);
    gl.uniform1f(u.uTrans, m.trans || 0);
    gl.uniform1f(u.uMetal, m.metal || 0);
    gl.uniform1f(u.uEmis, m.emis || 0);
    gl.uniform1f(u.uIrid, d.part.mat === 'body' || d.part.mat === 'feather' ? (a.irid || 0) : 0);
    gl.uniform1f(u.uShellT, 0);
    if (m.double || d.part.lid) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(d.vao);
    gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
    if (d.part.shells && !a.silhouette && a.shells !== false) {
      const { len, count } = d.part.shells;
      gl.uniform4fv(u.uShellU, d.part.shells.range || [0, 0.09, 0.95, 1]);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, strandTex);
      gl.uniform1i(u.uStrand, 2);
      gl.uniform2fv(u.uStrandRep, d.part.mat === 'head' ? [26, 30] : [Math.max(40, scene.info.bodyMap[scene.info.bodyMap.length - 1].s / 1.1), 26]);
      gl.uniform3fv(u.uShellDir, norm3([-1, -0.35, 0]).map((v) => v / Math.max(0.5, len)));
      gl.uniform1f(u.uBumpScale, 0);
      for (let i = 1; i <= count; i += 1) {
        const t = i / count;
        gl.uniform1f(u.uShell, len * t);
        gl.uniform1f(u.uShellT, 0.18 + t * 0.78);
        gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
      }
      gl.uniform1f(u.uShell, 0);
      gl.uniform1f(u.uShellT, 0);
    }
  }

  /**
   * Dibuja la escena. cam = { view, proj, pos }; o = { model, time, sway,
   * breath, yaw, pitch, blink, flapAmt, silhouette, shadows, ground, clear }.
   */
  function render(scene, cam, o = {}) {
    const W = canvas.width; const H = canvas.height;
    const model = o.model || m4.ident();
    const a = { ...scene.anim, irid: scene.irid, ...o };
    const bb0 = scene.bounds;
    a.radius = Math.hypot(bb0.max[0] - bb0.min[0], bb0.max[1] - bb0.min[1], bb0.max[2] - bb0.min[2]) * 0.55;
    // Cámara de la luz que encierra al animal (y su sombra en el suelo).
    const b = scene.bounds;
    const center = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const radius = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * 0.55;
    const lc = m4.apply(model, center);
    const lightView = m4.lookAt([lc[0] + light.key[0] * radius * 2.5, lc[1] + light.key[1] * radius * 2.5, lc[2] + light.key[2] * radius * 2.5], lc, [0, 1, 0]);
    const lightProj = m4.ortho(-radius * 1.25, radius * 1.25, -radius * 1.25, radius * 1.25, radius * 0.5, radius * 5);
    const lightVP = m4.mul(lightProj, lightView);
    const shadows = o.shadows !== false && !o.silhouette;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);
    if (shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
      gl.viewport(0, 0, SM, SM);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depth.p);
      setCommon(depth, model, { view: lightView, proj: lightProj }, lightVP, a);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.5, 2);
      for (const d of scene.draws) drawPart(depth, d, scene, a, 'depth');
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, W, H);
    const cc = o.clear || [0, 0, 0, 0];
    gl.clearColor(cc[0], cc[1], cc[2], cc[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Suelo: solo sombra y oclusión (fondo transparente).
    if (o.ground !== false && !o.silhouette) {
      const R2 = radius * 2.2;
      const yG = 0.02;
      const quadPts = [lc[0] - R2, yG, lc[2] - R2, lc[0] + R2, yG, lc[2] - R2, lc[0] + R2, yG, lc[2] + R2, lc[0] - R2, yG, lc[2] - R2, lc[0] + R2, yG, lc[2] + R2, lc[0] - R2, yG, lc[2] + R2];
      gl.bindBuffer(gl.ARRAY_BUFFER, groundBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadPts), gl.DYNAMIC_DRAW);
      gl.useProgram(ground.p);
      const u = ground.u;
      gl.uniformMatrix4fv(u.uView, false, cam.view);
      gl.uniformMatrix4fv(u.uProj, false, cam.proj);
      gl.uniformMatrix4fv(u.uLightVP, false, lightVP);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.uniform1i(u.uShadow, 1);
      gl.uniform1f(u.uUseShadow, shadows ? 1 : 0);
      const bw = (b.max[0] - b.min[0]) * 0.34;
      const bd = Math.max(6, (b.max[2] - b.min[2]) * 0.6);
      const float = scene.info.floats ? 0.35 : 1;
      gl.uniform4fv(u.uBlob, [lc[0], lc[2], bw, bd]);
      gl.uniform2fv(u.uOpacity, [0.42 * (scene.info.floats ? 0.5 : 1), 0.32 * float]);
      gl.uniform3fv(u.uCenter, lc);
      gl.uniform1f(u.uRadius, R2);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(groundVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.useProgram(lit.p);
    const u = lit.u;
    setCommon(lit, model, cam, lightVP, a);
    gl.uniform3fv(u.uCam, cam.pos);
    gl.uniform3fv(u.uKeyDir, light.key);
    gl.uniform3fv(u.uKeyCol, light.keyCol);
    gl.uniform3fv(u.uRimDir, light.rim);
    gl.uniform3fv(u.uRimCol, light.rimCol);
    gl.uniform3fv(u.uSky, light.sky);
    gl.uniform3fv(u.uGround, light.ground);
    gl.uniform1f(u.uExposure, o.exposure || 1.0);
    gl.uniform1f(u.uFlat, o.silhouette ? 1 : 0);
    gl.uniform3fv(u.uFlatCol, (o.silColor || scene.silColor).map((v) => v / 255));
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.uniform1i(u.uShadow, 1);
    gl.uniform1f(u.uUseShadow, shadows ? 1 : 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, bumpTex);
    gl.uniform1i(u.uBump, 3);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, strandTex);
    gl.uniform1i(u.uStrand, 2);
    gl.uniform1i(u.uMap, 0);
    for (const d of scene.draws) drawPart(lit, d, scene, a, 'main');
    gl.bindVertexArray(null);
  }

  return {
    gl, canvas, upload, dispose, render, light,
    destroy() {
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    },
  };
}
