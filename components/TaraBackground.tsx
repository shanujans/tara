'use client';
import { useEffect, useRef } from 'react';

/* ── WebGL aurora shader — Kapruka purple × indigo palette ─── */
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

  /* Kapruka brand colors */
  vec3 c1 = vec3(0.251, 0.161, 0.439); /* #402970 deep purple  */
  vec3 c2 = vec3(0.102, 0.055, 0.227); /* #1a0e3a dark indigo  */
  vec3 c3 = vec3(0.357, 0.247, 0.627); /* #5b3fa0 violet       */
  vec3 c4 = vec3(0.157, 0.094, 0.314); /* #281850 mid purple   */
  vec3 c5 = vec3(0.020, 0.012, 0.063); /* #05030f near black   */

  void main() {
    vec2 uv = v_uv;
    float w1 = sin(uv.x * 2.8 + u_time * 0.40) * 0.5 + 0.5;
    float w2 = sin(uv.y * 2.1 - u_time * 0.28) * 0.5 + 0.5;
    float w3 = sin((uv.x + uv.y) * 3.5 + u_time * 0.65) * 0.5 + 0.5;
    float n  = sin(uv.x * 8.0 + u_time * 0.9) * cos(uv.y * 8.0 + u_time * 0.7) * 0.5 + 0.5;
    vec3 m1  = mix(c1, c2, w1);
    vec3 m2  = mix(c3, c4, w2);
    vec3 col = mix(mix(m1, m2, w3), c5, n * 0.45);
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
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cleanup = boot(ref.current);
    return cleanup;
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        display: 'block',
      }}
    />
  );
}
