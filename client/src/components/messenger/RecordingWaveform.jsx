import { useEffect, useRef } from 'react';

const BAR_COUNT = 42;
const BAR_WIDTH = 3;
const GAP = 3;
const HEIGHT = 42;

// Draws real microphone levels without React re-rendering on every audio frame.
export default function RecordingWaveform({ analyser }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        if (!analyser) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!context) return;
        let frame = 0;
        let last = 0;
        const values = new Float32Array(analyser.fftSize);
        const bars = Array(BAR_COUNT).fill(0.08);
        const draw = (timestamp) => {
            frame = requestAnimationFrame(draw);
            if (timestamp - last < 45) return;
            last = timestamp;
            analyser.getFloatTimeDomainData(values);
            let sum = 0;
            for (let i = 0; i < values.length; i++) sum += values[i] * values[i];
            const level = Math.min(1, Math.sqrt(sum / values.length) * 5);
            bars.shift();
            bars.push(Math.max(0.08, level));
            const width = canvas.width;
            context.clearRect(0, 0, width, HEIGHT);
            const color = getComputedStyle(canvas).getPropertyValue('--brand-accent-1').trim() || '#d849ba';
            context.fillStyle = color;
            const step = width / BAR_COUNT;
            bars.forEach((value, index) => {
                const height = Math.max(3, Math.min(HEIGHT - 4, value * (HEIGHT - 4)));
                context.fillRect(index * step + (step - BAR_WIDTH) / 2, (HEIGHT - height) / 2, BAR_WIDTH, height);
            });
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [analyser]);
    return <canvas ref={canvasRef} width={BAR_COUNT * (BAR_WIDTH + GAP)} height={HEIGHT} className="mrr-v2-live-voice-waveform" role="img" aria-label="Уровень звука микрофона в реальном времени" />;
}
