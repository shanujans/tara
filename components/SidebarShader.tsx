'use client';
import { useEffect, useRef } from 'react';

/* Exact shader from design spec — wavy purple/lavender/yellow bands */
const VS = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FS = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;
vec3 color1 = vec3(0.114, 0.094, 0.176);
vec3 color2 = vec3(0.443, 0.290, 0.667);
vec3 color3 = vec3(0.843, 0.729, 1.000);
vec3 color4 = vec3(1.000, 0.843, 0.000);
vec3 color5 = vec3(0.950, 0.900, 1.000);
void main() {
    vec2 uv = v_texCoord;
    float wave = sin(uv.x * 6.0 + uv.y * 3.0 + u_time * 0.8) * 0.1;
    wave += sin(uv.x * 4.0 - uv.y * 2.0 + u_time * 0.5) * 0.05;
    float pos = uv.y + uv.x * 0.5 + wave;
    pos = mod(pos * 3.0, 1.0);
    vec3 color;
    if (pos < 0.22) {
        color = color1;
    } else if (pos < 0.50) {
        color = color2;
    } else if (pos < 0.72) {
        color = color3;
    } else if (pos < 0.92) {
        color = color4;
    } else {
        color = color5;
    }
    gl_FragColor = vec4(color, 1.0);
}`;

export default function SidebarShader() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas!.clientWidth  || 256;
      const h = canvas!.clientHeight || 800;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w; canvas!.height = h;
      }
    }

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncSize) : null;
    ro?.observe(canvas);
    syncSize();

    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return () => ro?.disconnect();

    function cs(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src); gl!.compileShader(s); return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, cs(gl.VERTEX_SHADER,   VS));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes  = gl.getUniformLocation(prog, 'u_resolution');

    let raf: number;
    function render(t: number) {
      if (!ro) syncSize();
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      if (uTime) gl!.uniform1f(uTime, t * 0.001);
      if (uRes)  gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    render(0);

    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
