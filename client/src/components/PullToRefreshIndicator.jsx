import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export default function PullToRefreshIndicator({ pull, refreshing, threshold = 70 }) {
    const reduced = useReducedMotion();
    const progress = Math.min(1, pull / threshold);
    const visible = refreshing || pull > 0;
    return (
        <AnimatePresence initial={false}>
            {visible && (
                <motion.div
                    key="pull-refresh"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: refreshing ? 68 : Math.min(76, pull * 0.65), opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 32, duration: reduced ? 0 : undefined }}
                    className="overflow-hidden flex justify-center items-center"
                    role="status"
                    aria-live={refreshing ? 'polite' : 'off'}
                >
                    <motion.div
                        animate={refreshing ? { rotate: 360, scale: 1 } : { rotate: progress * 160, scale: 0.8 + progress * 0.2 }}
                        transition={refreshing ? { rotate: { repeat: Infinity, duration: 0.9, ease: 'linear' } } : { duration: 0.08 }}
                        className="grid place-items-center w-10 h-10 rounded-full bg-violet-500/15 border border-violet-400/40 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,.18)]"
                    >
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 19h14"/></svg>
                    </motion.div>
                    <span className="ml-3 text-sm font-medium text-white/65">{refreshing ? 'Обновляем ленту…' : progress >= 1 ? 'Отпустите для обновления' : 'Потяните для обновления'}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
