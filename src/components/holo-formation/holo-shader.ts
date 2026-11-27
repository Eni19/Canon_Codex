/**
 * Shader da formação holográfica: um fluido escuro e marmorizado que se desfaz por profundidade.
 * O que está mais perto (a figura do retrato) se forma primeiro; o resto da página aparece depois,
 * a partir dela. Na frente da formação a cor vira película holográfica (rosa, ciano, amarelo) e a
 * imagem chega deformada, assentando no lugar.
 */
export const HOLO_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const HOLO_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;        // tamanho do canvas, em px
uniform float uProgress;  // 0 = tudo fluido, 1 = tudo formado
uniform float uTime;      // segundos
uniform sampler2D uImage;
uniform float uHasImage;
uniform vec4 uImageRect;  // retângulo desenhado da imagem: x, y, largura, altura (px, origem em cima)
uniform vec2 uClipY;      // faixa vertical visível da imagem (px)
uniform vec2 uFocus;      // centro da figura (px): de onde a página se forma
uniform vec3 uBase;       // fundo da página
uniform vec3 uAccent;     // cor de destaque do tema

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
vec3 film(float x) {
  // Paleta de película fina: rosa, ciano e amarelo pálidos.
  return 0.74 + 0.26 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + x));
}
vec4 sampleImage(vec2 px) {
  vec2 uv = (px - uImageRect.xy) / uImageRect.zw;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(uClipY.x, px.y) * step(px.y, uClipY.y);
  return uHasImage * inside * texture2D(uImage, clamp(uv, 0.0, 1.0));
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 p = px / uRes.y;
  float t = uTime;

  // Fluido: deformação de domínio em duas camadas, sempre andando devagar.
  vec2 q = vec2(fbm(p * 1.8 + vec2(0.0, t * 0.05)), fbm(p * 1.8 + vec2(5.2, 1.3) - t * 0.04));
  vec2 r = vec2(fbm(p * 2.2 + 3.5 * q + vec2(1.7, 9.2) + t * 0.06), fbm(p * 2.2 + 3.5 * q + vec2(8.3, 2.8) - t * 0.05));
  float n = fbm(p * 2.6 + 3.0 * r);

  // Profundidade: a figura (opaca no retrato) fica perto; o resto se afasta a partir dela.
  vec4 still = sampleImage(px);
  float luma = dot(still.rgb, vec3(0.299, 0.587, 0.114));
  float far = clamp(length((px - uFocus) / uRes.y) * 0.85, 0.0, 1.0);
  float depth = mix(0.3 + 0.65 * far, 0.05 + 0.18 * (1.0 - luma), still.a);

  // Quanto este ponto já se formou: a frente avança com o progresso, recortada pelo fluido.
  float front = uProgress * 1.4 - 0.2 - (n - 0.5) * 0.45;
  // A figura leva mais tempo para assentar, para o derretimento aparecer.
  float band = mix(0.1, 0.2, still.a);
  float formed = smoothstep(depth - band, depth + band, front);
  float edge = 1.0 - abs(formed * 2.0 - 1.0);

  // A imagem chega puxada pelo fluido e assenta quando se forma.
  vec2 drift = (r - 0.5) * uRes.y * 0.38 * (1.0 - formed) * (1.0 - formed);
  vec4 image = sampleImage(px + drift);

  // Fluido cor de tinta, frio e escuro, com veios claros e só um pouco de película nas cristas.
  float veins = smoothstep(0.6, 1.0, sin(n * 24.0 + r.x * 6.0) * 0.5 + 0.5);
  vec3 holo = mix(film(n * 1.4 + r.y * 0.8 + t * 0.04), uAccent, 0.12);
  vec3 ink = mix(uBase, vec3(0.035, 0.05, 0.095), 0.7);
  vec3 fluid = ink + veins * vec3(0.62, 0.68, 0.78) * 0.38 * smoothstep(0.35, 0.8, n);
  fluid = mix(fluid, holo * 0.75, smoothstep(0.7, 0.95, n) * 0.22);

  // Na frente da formação, a cor vira película; a imagem herda o reflexo enquanto assenta.
  vec3 imageColor = mix(image.rgb, image.rgb * 0.6 + holo * 0.7, (1.0 - formed) * 0.9);
  vec3 color = mix(fluid, holo, edge * 0.7);
  float alpha = 1.0 - formed;
  color = mix(color, imageColor, image.a * max(formed, 0.35 * edge));
  alpha = max(alpha, image.a * (0.35 + 0.65 * formed));
  alpha = max(alpha, edge * 0.6);
  // Cor já multiplicada pela opacidade: é o formato que todo navegador compõe igual. Com a cor
  // "solta", o Chromium no Windows somava o fluido à página mesmo onde ele já era transparente.
  float a = clamp(alpha, 0.0, 1.0);
  gl_FragColor = vec4(color * a, a);
}
`
