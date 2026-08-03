import { useEffect, useId, useRef } from 'react';

/**
 * Bendera Merah Putih dengan animasi kain realistis.
 *
 * Props:
 * - width: lebar SVG
 * - height: tinggi SVG
 * - wave: aktif/nonaktif animasi
 * - intensity: kekuatan kibaran, rekomendasi 0.7–1.3
 * - speed: kecepatan kibaran, rekomendasi 0.7–1.4
 */
export default function FlagWaveCanvas({
  width = 170,
  height = 113,
  wave = true,
  intensity = 1,
  speed = 1,
}) {
  const redRef = useRef(null);
  const whiteRef = useRef(null);

  const shadeRef = useRef(null);
  const lightRef = useRef(null);
  const textureRef = useRef(null);
  const outlineRef = useRef(null);

  const shadeGradientRef = useRef(null);
  const lightGradientRef = useRef(null);

  const rawId = useId().replace(/:/g, '');

  const shadeId = `flag-shade-${rawId}`;
  const lightId = `flag-light-${rawId}`;
  const textureId = `flag-texture-${rawId}`;
  const shadowId = `flag-shadow-${rawId}`;

  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    let animationTime = 0;
    let destroyed = false;

    const clamp = (value, min, max) =>
      Math.min(max, Math.max(min, value));

    const smoothStep = (value) => {
      const x = clamp(value, 0, 1);
      return x * x * (3 - 2 * x);
    };

    /*
     * Deformasi kain.
     *
     * Sumbu Y menggunakan kombinasi beberapa sine wave:
     * - gelombang utama untuk gerakan kain
     * - lipatan menengah
     * - flutter kecil pada ujung bendera
     *
     * Sumbu X sedikit bergerak untuk memberi ilusi kedalaman.
     */
    const deformPoint = (x, y) => {
      if (!wave) {
        return [x, y];
      }

      const normalizedX = clamp(x / width, 0, 1);

      // Mengunci kain di sisi tiang.
      const pinning = smoothStep(normalizedX);

      // Ujung kain bergerak lebih besar daripada bagian dekat tiang.
      const taper = Math.pow(pinning, 1.45);

      const verticalPosition = y / height;

      const baseAmplitude = height * 0.052 * intensity;

      const mainWave =
        Math.sin(
          x * 0.071 -
            animationTime * 2.25 * speed +
            verticalPosition * 1.25,
        );

      const secondaryWave =
        0.36 *
        Math.sin(
          x * 0.148 -
            animationTime * 3.7 * speed +
            verticalPosition * 2.1 +
            0.85,
        );

      const edgeFlutter =
        0.14 *
        Math.sin(
          x * 0.31 -
            animationTime * 6.1 * speed +
            verticalPosition * 3.2 +
            1.75,
        );

      const freeEdgeFlutter =
        0.1 *
        Math.pow(normalizedX, 4) *
        Math.sin(
          x * 0.43 -
            animationTime * 8.4 * speed +
            verticalPosition * 4.5,
        );

      const yOffset =
        baseAmplitude *
        taper *
        (mainWave + secondaryWave + edgeFlutter + freeEdgeFlutter);

      /*
       * Sedikit kompresi vertikal untuk memberi kesan kain
       * melipat ke depan dan ke belakang.
       */
      const depthWave =
        Math.sin(
          x * 0.07 -
            animationTime * 2.25 * speed +
            verticalPosition * 1.1 +
            0.45,
        );

      const verticalCompression = 1 - 0.025 * taper * depthWave;

      const centerY = height / 2;

      const compressedY =
        centerY + (y - centerY) * verticalCompression;

      /*
       * Deformasi horizontal memberi efek perspektif.
       * Nilainya dibuat kecil agar bentuk 2:3 tetap terjaga.
       */
      const horizontalWave =
        1.7 *
          Math.sin(
            x * 0.066 -
              animationTime * 2.1 * speed +
              verticalPosition * 1.15 +
              1.1,
          ) +
        0.55 *
          Math.sin(
            x * 0.19 -
              animationTime * 4.1 * speed +
              verticalPosition * 2.4,
          );

      const twistX =
        (verticalPosition - 0.5) *
        1.2 *
        Math.sin(x * 0.082 - animationTime * 2.55 * speed);

      const xOffset = taper * intensity * (horizontalWave + twistX);

      return [x + xOffset, compressedY + yOffset];
    };

    /*
     * Membuat baris titik horizontal yang telah dideformasi.
     */
    const createRow = (baseY) => {
      const points = [];

      const sampleDistance = Math.max(1.5, width / 115);

      for (let x = 0; x < width; x += sampleDistance) {
        points.push(deformPoint(x, baseY));
      }

      points.push(deformPoint(width, baseY));

      return points;
    };

    /*
     * Catmull-Rom menjadi cubic Bézier.
     * Lebih halus dibanding polyline dan Q Bézier sederhana.
     */
    const smoothOpenPath = (points, startWithMove = true) => {
      if (!points.length) return '';

      const command = startWithMove ? 'M' : 'L';

      let path = `${command} ${points[0][0].toFixed(1)} ${points[0][1].toFixed(2)}`;

      const tension = 0.82;

      for (let index = 0; index < points.length - 1; index += 1) {
        const p0 = points[Math.max(0, index - 1)];
        const p1 = points[index];
        const p2 = points[index + 1];
        const p3 = points[Math.min(points.length - 1, index + 2)];

        const control1X = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
        const control1Y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
        const control2X = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
        const control2Y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;

        path +=
          ` C ${control1X.toFixed(1)} ${control1Y.toFixed(2)} ` +
          `${control2X.toFixed(1)} ${control2Y.toFixed(2)} ` +
          `${p2[0].toFixed(1)} ${p2[1].toFixed(2)}`;
      }

      return path;
    };

    /*
     * Top berjalan kiri → kanan.
     * Bottom berjalan kanan → kiri.
     *
     * Hasilnya benar-benar satu path tertutup,
     * bukan dua subpath terpisah.
     */
    const buildBandPath = (topPoints, bottomPoints) => {
      const reversedBottom = [...bottomPoints].reverse();

      return (
        smoothOpenPath(topPoints, true) +
        smoothOpenPath(reversedBottom, false) +
        ' Z'
      );
    };

    const renderFrame = (now) => {
      if (destroyed) return;

      const delta = Math.min(50, now - lastTime) / 1000;

      lastTime = now;

      if (wave) {
        animationTime += delta;
      }

      const topPoints = createRow(0);
      const middlePoints = createRow(height / 2);
      const bottomPoints = createRow(height);

      const redPath = buildBandPath(topPoints, middlePoints);
      const whitePath = buildBandPath(middlePoints, bottomPoints);
      const fullFlagPath = buildBandPath(topPoints, bottomPoints);

      redRef.current?.setAttribute('d', redPath);
      whiteRef.current?.setAttribute('d', whitePath);

      shadeRef.current?.setAttribute('d', fullFlagPath);
      lightRef.current?.setAttribute('d', fullFlagPath);
      textureRef.current?.setAttribute('d', fullFlagPath);
      outlineRef.current?.setAttribute('d', fullFlagPath);

      /*
       * Bayangan dan highlight bergerak bersamaan dengan gelombang,
       * sehingga lipatan kain tidak terlihat diam.
       */
      const shadeMovement =
        -(animationTime * 11 * speed) % Math.max(42, width * 0.35);

      const lightMovement =
        -(animationTime * 8 * speed) % Math.max(54, width * 0.46);

      shadeGradientRef.current?.setAttribute(
        'gradientTransform',
        `translate(${shadeMovement.toFixed(2)} 0)`,
      );

      lightGradientRef.current?.setAttribute(
        'gradientTransform',
        `translate(${lightMovement.toFixed(2)} 0)`,
      );

      if (wave && !document.hidden) {
        raf = requestAnimationFrame(renderFrame);
      }
    };

    const startAnimation = () => {
      cancelAnimationFrame(raf);
      lastTime = performance.now();
      raf = requestAnimationFrame(renderFrame);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        startAnimation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (wave) {
      startAnimation();
    } else {
      renderFrame(performance.now());
    }

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [width, height, wave, intensity, speed]);

  const shadePatternWidth = Math.max(42, width * 0.35);
  const lightPatternWidth = Math.max(54, width * 0.46);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Bendera Merah Putih berkibar"
      style={{
        display: 'block',
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Bayangan lipatan kain */}
        <linearGradient
          ref={shadeGradientRef}
          id={shadeId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={shadePatternWidth}
          y2="0"
          spreadMethod="repeat"
        >
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="23%" stopColor="#000000" stopOpacity="0.04" />
          <stop offset="42%" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="58%" stopColor="#000000" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* Pantulan cahaya pada puncak lipatan */}
        <linearGradient
          ref={lightGradientRef}
          id={lightId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={lightPatternWidth}
          y2="0"
          spreadMethod="repeat"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="49%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="63%" stopColor="#ffffff" stopOpacity="0.035" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Tekstur tenunan kain yang sangat tipis */}
        <pattern
          id={textureId}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(9)"
        >
          <path
            d="M 0 0 H 4"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.09"
            strokeWidth="0.28"
          />
          <path
            d="M 0 2 H 4"
            fill="none"
            stroke="#000000"
            strokeOpacity="0.045"
            strokeWidth="0.24"
          />
        </pattern>

        {/* Bayangan luar lembut */}
        <filter id={shadowId} x="-15%" y="-20%" width="140%" height="150%">
          <feDropShadow
            dx="0.8"
            dy="2"
            stdDeviation="1.7"
            floodColor="#000000"
            floodOpacity="0.3"
          />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        {/* Bagian merah */}
        <path
          ref={redRef}
          fill="#ce1126"
          stroke="#ce1126"
          strokeWidth="0.45"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bagian putih */}
        <path
          ref={whiteRef}
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth="0.45"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bayangan lipatan */}
        <path
          ref={shadeRef}
          fill={`url(#${shadeId})`}
          opacity="0.72"
          pointerEvents="none"
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Highlight lipatan */}
        <path
          ref={lightRef}
          fill={`url(#${lightId})`}
          opacity="0.7"
          pointerEvents="none"
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Tekstur kain */}
        <path
          ref={textureRef}
          fill={`url(#${textureId})`}
          opacity="0.42"
          pointerEvents="none"
        />

        {/* Outline tipis agar bentuk kain tetap terbaca */}
        <path
          ref={outlineRef}
          fill="none"
          stroke="#000000"
          strokeOpacity="0.12"
          strokeWidth="0.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>
    </svg>
  );
}
