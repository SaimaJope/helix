(() => {
  'use strict';

  const SELECTOR = 'canvas[data-procedural-field]';
  const instances = new WeakMap();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentBody = `
    precision highp float;

    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_variant;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 cell = floor(p);
      vec2 local = fract(p);
      vec2 curve = local * local * (3.0 - 2.0 * local);
      float a = hash21(cell);
      float b = hash21(cell + vec2(1.0, 0.0));
      float c = hash21(cell + vec2(0.0, 1.0));
      float d = hash21(cell + vec2(1.0, 1.0));
      return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
      for (int octave = 0; octave < 5; octave++) {
        value += amplitude * noise2(p);
        p = rotation * p * 2.03 + vec2(17.1, 9.2);
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 uv = v_uv;
      float aspect = u_resolution.x / max(u_resolution.y, 1.0);
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      p += (u_pointer - 0.5) * vec2(0.018, -0.012);

      float time = u_time * 0.014;
      vec2 domain = p * mix(7.00, 3.05, u_variant);
      vec2 firstWarp = vec2(
        fbm(domain + vec2(time, -time * 0.48)),
        fbm(domain + vec2(5.2, 1.3) + vec2(-time * 0.62, time * 0.35))
      );
      vec2 secondWarp = vec2(
        fbm(domain + 3.2 * firstWarp + vec2(1.7, 9.2) + time * 0.35),
        fbm(domain + 3.2 * firstWarp + vec2(8.3, 2.8) - time * 0.28)
      );

      float field = p.x * 0.34 + secondWarp.x * 1.12 + firstWarp.y * 0.24;
      float contourScale = mix(52.0, 16.7, u_variant);
      float contourPhase = field * contourScale - time * 0.22;

      // How much of a contour cycle a single pixel covers. Measured on the phase,
      // not on the cosine: fwidth(wave) vanishes at every crest and trough, which is
      // precisely where the aliasing shows, so it cannot be used to size the filter.
      #ifdef HX_DERIVATIVES
        float cyclesPerPixel = fwidth(contourPhase);
      #else
        float cyclesPerPixel = contourScale * 1.6 / min(u_resolution.x, u_resolution.y);
      #endif
      cyclesPerPixel = max(cyclesPerPixel, 1.0 / min(u_resolution.x, u_resolution.y));

      // Fade the pattern out as it approaches the Nyquist limit instead of letting it
      // fold back into moire. Wide viewports push the phase gradient much higher.
      float bandLimit = 1.0 - smoothstep(0.20, 0.55, cyclesPerPixel);

      float wave = 0.5 + 0.5 * cos(contourPhase * 6.28318);
      float pixelFootprint = min(3.14159 * cyclesPerPixel, 0.5);
      float rampWidth = 0.10 + pixelFootprint * 0.90;
      float contourWidth = 0.075 + pixelFootprint * 1.35;
      float ramp = mix(0.5, smoothstep(0.5 - rampWidth, 0.5 + rampWidth, wave), bandLimit);
      float contour = (1.0 - smoothstep(0.0, contourWidth, abs(wave - 0.5))) * bandLimit;

      float grain = hash21(gl_FragCoord.xy) - 0.5;

      vec3 heroDeep = vec3(0.026, 0.172, 0.128);
      vec3 heroGreen = vec3(0.120, 0.402, 0.300);
      vec3 footerDeep = vec3(0.062, 0.057, 0.046);
      vec3 footerLift = vec3(0.160, 0.148, 0.116);
      vec3 gold = vec3(0.851, 0.635, 0.231);
      vec3 cream = vec3(0.965, 0.945, 0.875);

      vec3 base = mix(heroDeep, footerDeep, u_variant);
      vec3 lifted = mix(heroGreen, footerLift, u_variant);
      vec3 color = mix(base, lifted, mix(0.18 + ramp * 0.31, 0.22 + ramp * 0.25, u_variant));

      color += gold * contour * mix(0.035, 0.022, u_variant);
      color += cream * contour * mix(0.007, 0.004, u_variant);
      color += grain * mix(0.0, 0.003, u_variant);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // #extension has to lead the source, so the derivative support is decided per context.
  function buildFragmentSource(hasDerivatives) {
    return hasDerivatives
      ? '#extension GL_OES_standard_derivatives : enable\n#define HX_DERIVATIVES 1\n' + fragmentBody
      : fragmentBody;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Unable to compile procedural field shader.');
    }
    return shader;
  }

  function createProgram(gl, hasDerivatives) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, buildFragmentSource(hasDerivatives)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Unable to link procedural field shader.');
    }
    return program;
  }

  class ProceduralField {
    constructor(canvas) {
      this.canvas = canvas;
      this.variant = canvas.dataset.proceduralField === 'footer' ? 1 : 0;
      this.visible = true;
      this.lastFrame = 0;
      this.render = this.render.bind(this);

      const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: 'low-power',
        preserveDrawingBuffer: reduceMotion.matches
      });

      if (!gl) {
        canvas.style.background = this.variant ? '#26241e' : '#18513f';
        return;
      }

      this.gl = gl;
      const hasDerivatives = Boolean(gl.getExtension('OES_standard_derivatives'));
      this.maxBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096;
      this.program = createProgram(gl, hasDerivatives);
      gl.useProgram(this.program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      const position = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      this.uniforms = {
        resolution: gl.getUniformLocation(this.program, 'u_resolution'),
        pointer: gl.getUniformLocation(this.program, 'u_pointer'),
        time: gl.getUniformLocation(this.program, 'u_time'),
        variant: gl.getUniformLocation(this.program, 'u_variant')
      };

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      this.resize();

      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
      }, { rootMargin: '180px' });
      this.intersectionObserver.observe(canvas);

      requestAnimationFrame(this.render);
    }

    resize() {
      if (!this.gl) return;
      const rect = this.canvas.getBoundingClientRect();
      const deviceDensity = window.devicePixelRatio || 1;
      const density = this.variant
        ? Math.min(Math.max(deviceDensity, 1.5), 2)
        : Math.min(Math.max(deviceDensity * 1.35, 2), 2.5);
      // A drawing buffer larger than the context allows is silently clamped by the
      // browser while canvas.width keeps the requested value, which desyncs the
      // viewport. Scale the density down instead of letting that happen.
      const limit = this.maxBufferSize;
      const maxPixels = 5.5e6;
      const fit = Math.min(
        1,
        limit / Math.max(rect.width * density, 1),
        limit / Math.max(rect.height * density, 1),
        Math.sqrt(maxPixels / Math.max(rect.width * rect.height * density * density, 1))
      );
      const scale = density * fit;
      const width = Math.max(2, Math.round(rect.width * scale));
      const height = Math.max(2, Math.round(rect.height * scale));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
      }
    }

    render(now) {
      if (!this.gl) return;
      if (!this.canvas.isConnected) {
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        return;
      }
      if (!this.visible) {
        requestAnimationFrame(this.render);
        return;
      }

      const isStatic = reduceMotion.matches;
      if (!isStatic && now - this.lastFrame < (this.variant ? 14 : 28)) {
        requestAnimationFrame(this.render);
        return;
      }

      this.lastFrame = now;
      pointer.x += (pointer.tx - pointer.x) * 0.035;
      pointer.y += (pointer.ty - pointer.y) * 0.035;

      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.uniforms.pointer, pointer.x, pointer.y);
      gl.uniform1f(this.uniforms.time, isStatic ? 4.0 : now * 0.001);
      gl.uniform1f(this.uniforms.variant, this.variant);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!isStatic) requestAnimationFrame(this.render);
    }
  }

  function mount(root = document) {
    root.querySelectorAll(SELECTOR).forEach((canvas) => {
      if (instances.has(canvas)) return;
      try {
        instances.set(canvas, new ProceduralField(canvas));
      } catch (error) {
        canvas.style.background = canvas.dataset.proceduralField === 'footer' ? '#26241e' : '#18513f';
        console.warn('Procedural field fallback:', error);
      }
    });
  }

  window.addEventListener('pointermove', (event) => {
    pointer.tx = event.clientX / Math.max(window.innerWidth, 1);
    pointer.ty = 1 - event.clientY / Math.max(window.innerHeight, 1);
  }, { passive: true });

  const start = () => {
    mount();
    const observer = new MutationObserver(() => mount());
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
