'use client';
import { useEffect, useRef } from 'react';

/* ── Lumina palette — vivid enough to bleed through glass overlays ── */
const VS = `
  attribute vec4 a_position;
  varying vec2 v_uv;
  void main() {
    gl_Position = a_position;
    v_uv = a_position.xy * 0.5 + 0.5;
  }
`;

const FS = `
  precision highp float;
  varying vec2 v_uv;
  uniform float u_time;

  /* Lumina design system — brighter to pierce glass layers */
  vec3 c1 = vec3(0.255, 0.078, 0.471); /* #411478 primary deep */
  vec3 c2 = vec3(0.063, 0.043, 0.122); /* #100b1f void base    */
  vec3 c3 = vec3(0.443, 0.290, 0.667); /* #714aaa violet mid   */
  vec3 c4 = vec3(0.188, 0.114, 0.353); /* #301d5a dark mid     */
  vec3 c5 = vec3(0.082, 0.067, 0.141); /* #151024 surface      */
  vec3 cg = vec3(0.420, 0.478, 0.165); /* #6b7a2a gold-green   */

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }

  void main() {
    vec2 uv = v_uv;

    /* Organic wave layers */
    float w1 = sin(uv.x * 3.2 + u_time * 0.35) * 0.5 + 0.5;
    float w2 = sin(uv.y * 2.4 - u_time * 0.22) * 0.5 + 0.5;
    float w3 = sin((uv.x + uv.y) * 4.1 + u_time * 0.55) * 0.5 + 0.5;
    float w4 = cos(uv.x * 1.8 - uv.y * 2.6 + u_time * 0.18) * 0.5 + 0.5;

    /* Micro noise for texture */
    float n = sin(uv.x * 9.0 + u_time * 0.8) * cos(uv.y * 9.0 + u_time * 0.6) * 0.5 + 0.5;

    /* Gold-green aurora hint (secondary color accent) */
    float goldWave = smoothstep(0.6, 0.9, sin(uv.y * 5.0 + u_time * 0.4) * 0.5 + 0.5);
    goldWave *= smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);

    vec3 m1  = mix(c1, c3, w1);          /* purple range */
    vec3 m2  = mix(c4, c2, w2);          /* dark range */
    vec3 col = mix(mix(m1, m2, w3), c5, n * 0.30);
    col      = mix(col, c3, w4 * 0.25);  /* violet shimmer */
    col      = mix(col, cg, goldWave * 0.12); /* subtle gold streak */

    gl_FragColor = vec4(col, 1.0);
  }
`;

function boot(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl');
  if (!gl) return () => {};

  function mkShader(type: number, src: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER,   VS));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW,
  );

  const posLoc  = gl.getAttribLocation(prog,  'a_position');
  const timeLoc = gl.getUniformLocation(prog, 'u_time');
  const t0 = Date.now();
  let raf: number;

  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl!.viewport(0, 0, w, h);
    gl!.useProgram(prog);
    gl!.enableVertexAttribArray(posLoc);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
    gl!.vertexAttribPointer(posLoc, 2, gl!.FLOAT, false, 0, 0);
    gl!.uniform1f(timeLoc, (Date.now() - t0) / 1000);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    raf = requestAnimationFrame(frame);
  }

  frame();
  return () => cancelAnimationFrame(raf);
}

export default function TaraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cleanup = boot(canvas);
    return cleanup;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,         /* sit above body bg, below all UI */
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
