import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const TEMPLATES = {
    gradient: {
        bg: (a, b) => `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        text: '#ffffff',
        overlay: 'radial-gradient(ellipse_at_top_left, rgba(255,255,255,0.25), transparent 60%)',
        accentBorder: 'rgba(255,255,255,0.3)',
        // solid используется как background для html-to-image —
        // чтобы при скруглённых углах не было прозрачных пикселей
        solid: '#7C3AED',
    },
    classic: {
        bg: () => '#fdfaf3',
        text: '#1a1a1a',
        overlay: 'radial-gradient(ellipse_at_center, rgba(0,0,0,0.03), transparent 70%)',
        accentBorder: 'rgba(0,0,0,0.15)',
        solid: '#fdfaf3',
    },
    dark: {
        bg: () => '#0b0b14',
        text: '#ffffff',
        overlay: 'radial-gradient(ellipse_at_top_right, rgba(124,58,237,0.35), transparent 60%)',
        accentBorder: 'rgba(255,255,255,0.15)',
        solid: '#0b0b14',
    },
    minimal: {
        bg: () => '#ffffff',
        text: '#1a1a1a',
        overlay: 'none',
        accentBorder: 'rgba(0,0,0,0.08)',
        solid: '#ffffff',
    },
};

export default function Certificate() {
    const { id } = useParams();
    const { token } = useAuth();
    const [cert, setCert] = useState(null);
    const [settings, setSettings] = useState({});
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const certRef = useRef(null);

    useEffect(() => {
        api(`/courses/certificates/${id}`, { token }).then(setCert).catch((e) => setError(e.message));
        api('/settings/public').then(setSettings).catch(() => {});
    }, [id, token]);

    const design = useMemo(() => {
        const tpl = TEMPLATES[settings.certificate_template] || TEMPLATES.gradient;
        const accent1 = settings.certificate_accent_1 || '#7C3AED';
        const accent2 = settings.certificate_accent_2 || '#EC4899';
        return {
            template: tpl,
            accent1,
            accent2,
            org: settings.certificate_org_name || 'MEDIA·RAF·RAW',
            subtitle: settings.certificate_subtitle || 'Студенческий медиацентр',
            signature: settings.certificate_signature || '',
        };
    }, [settings]);

    /*
     * Скачивание в PDF.
     *
     * Почему html-to-image, а не html2canvas:
     *   html2canvas не поддерживает CSS-градиенты (linear-gradient,
     *   radial-gradient в background-image) — на выходе получается
     *   чёрно-белый «снимок» без фирменного фона.
     *
     *   html-to-image сериализует DOM в SVG через foreignObject и
     *   рендерит его средствами самого браузера — то есть всё, что
     *   видно на экране (градиенты, веб-шрифты Space Grotesk,
     *   вложенный SVG с QR-кодом), попадает в PNG один в один.
     *
     * Дальше PNG вписывается в A4 landscape и сохраняется как PDF.
     */
    const downloadPDF = async () => {
        const node = certRef.current;
        if (!node) return;
        setDownloading(true);
        try {
            const [{ toPng }, { jsPDF }] = await Promise.all([
                import('html-to-image'),
                import('jspdf'),
            ]);

            // Дожидаемся полной загрузки шрифтов: иначе в PDF
            // уедет system-ui вместо Space Grotesk.
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            // Небольшая задержка — на части браузеров fonts.ready
            // резолвится раньше фактического применения шрифта.
            await new Promise((r) => setTimeout(r, 80));

            // Размеры берём из layout-метрик (offsetWidth/Height),
            // а не из getBoundingClientRect — rect искажается
            // CSS-трансформами и zoom'ом.
            const w0 = node.offsetWidth;
            const h0 = node.offsetHeight;

            const dataUrl = await toPng(node, {
                pixelRatio: 3,              // 3× для чёткости при печати
                cacheBust: true,
                backgroundColor: design.template.solid || '#0b0b14',
                width: w0,
                height: h0,
                style: {
                    // Снимаем возможные трансформы/масштаб,
                    // чтобы захват был 1:1
                    transform: 'none',
                    margin: '0',
                },
            });

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true,
            });

            const pdfW = pdf.internal.pageSize.getWidth();
            const pdfH = pdf.internal.pageSize.getHeight();

            // Вписываем картинку в лист A4 landscape с сохранением пропорций
            const imgRatio = w0 / h0;
            const pdfRatio = pdfW / pdfH;

            let w, h;
            if (imgRatio > pdfRatio) {
                w = pdfW;
                h = pdfW / imgRatio;
            } else {
                h = pdfH;
                w = pdfH * imgRatio;
            }

            const x = (pdfW - w) / 2;
            const y = (pdfH - h) / 2;

            pdf.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST');
            pdf.save(`certificate-${cert.serial}.pdf`);
        } catch (e) {
            console.error('PDF error:', e);
            alert('Не удалось создать PDF: ' + (e.message || 'неизвестная ошибка'));
        } finally {
            setDownloading(false);
        }
    };

    if (error) return <div className="p-10 text-center text-pink">{error}</div>;
    if (!cert) return <div className="p-10 text-center text-white/40">Загрузка…</div>;

    const d = design;
    const verifyUrl = `${window.location.origin}/verify/${cert.serial}`;

    return (
        <div className="p-5 md:p-10 max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-5 print:hidden">
                <Link to="/app" className="text-white/50 hover:text-white">← Назад</Link>

                <div className="flex gap-2">
                    {/* Печать — встроенный механизм браузера.
                        Полезно, если нужно сохранить с разметкой,
                        полями, шрифтами ОС. */}
                    <button
                        onClick={() => window.print()}
                        className="btn-ghost !py-2 text-sm"
                        title="Печать (или Сохранить как PDF)"
                    >
                        🖨️ Печать
                    </button>

                    <button
                        onClick={downloadPDF}
                        disabled={downloading}
                        className="btn-primary !py-2"
                    >
                        {downloading ? 'Готовим PDF…' : '⬇ Скачать PDF'}
                    </button>
                </div>
            </div>

            {/*
              Узел для захвата. Ничего лишнего — только сам сертификат.
              Кнопки и подписи вынесены за его пределы.
            */}
            <div
                ref={certRef}
                className="relative rounded-3xl overflow-hidden shadow-2xl print:shadow-none"
            >
                <div className="absolute inset-0" style={{ background: d.template.bg(d.accent1, d.accent2) }} />
                {d.template.overlay !== 'none' && (
                    <div className="absolute inset-0" style={{ background: d.template.overlay }} />
                )}

                <div
                    className="absolute inset-4 md:inset-6 rounded-2xl border-2 pointer-events-none"
                    style={{ borderColor: d.template.accentBorder }}
                />

                <div className="relative p-8 md:p-14" style={{ color: d.template.text }}>
                    <div className="text-center">
                        <div className="text-sm uppercase tracking-[0.4em] opacity-80">{d.org}</div>
                        <div className="text-xs uppercase tracking-widest opacity-60 mt-1">{d.subtitle}</div>
                    </div>

                    <div className="my-8 md:my-12 text-center">
                        <div className="text-xs uppercase tracking-[0.3em] opacity-70 mb-3">Сертификат</div>
                        <div className="text-xl md:text-3xl font-bold mb-6">подтверждает, что</div>
                        <div className="text-3xl md:text-5xl font-extrabold tracking-tight break-words">
                            {cert.user.fullName}
                        </div>
                        <div className="text-lg md:text-2xl opacity-90 mt-4">успешно прошёл(ла) курс</div>
                        <div className="text-xl md:text-2xl font-bold mt-3">«{cert.course.title}»</div>
                        {cert.description && (
                            <p className="mt-4 max-w-xl mx-auto text-sm opacity-80">{cert.description}</p>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 mt-8">
                        <div className="text-center md:text-left">
                            <div className="text-xs uppercase tracking-widest opacity-60">Дата выдачи</div>
                            <div className="text-base md:text-lg font-semibold">
                                {new Date(cert.issuedAt).toLocaleDateString('ru-RU')}
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <div className="bg-white p-2 rounded-xl shadow-lg">
                                <QRCodeSVG
                                    value={verifyUrl}
                                    size={84}
                                    bgColor="#ffffff"
                                    fgColor="#000000"
                                    level="M"
                                />
                            </div>
                            <div className="text-[10px] uppercase tracking-widest opacity-60">
                                Проверить подлинность
                            </div>
                        </div>

                        <div className="text-center md:text-right">
                            <div className="text-xs uppercase tracking-widest opacity-60">Серийный номер</div>
                            <div className="text-base md:text-lg font-mono font-semibold">{cert.serial}</div>
                            {d.signature && (
                                <div className="text-xs opacity-60 mt-2">{d.signature}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-center text-xs text-white/40 print:hidden">
                Публичная ссылка для проверки:{' '}
                <Link
                    to={`/verify/${cert.serial}`}
                    className="text-violet-soft hover:text-white font-mono"
                >
                    {verifyUrl}
                </Link>
            </div>
        </div>
    );
}