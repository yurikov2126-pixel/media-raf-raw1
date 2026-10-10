import React from 'react';

/** Isolates failures inside a task card so a single broken attachment cannot blank the page. */
export default class EditorialTaskErrorBoundary extends React.Component {
    state = { error: false };
    static getDerivedStateFromError() { return { error:true }; }
    componentDidCatch(error, info) {
        console.error('[editorial task]', error, info.componentStack);
    }
    render() {
        if (this.state.error) {
            return <div role="alert" className="space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-100">
                <h3 className="font-semibold">Не удалось отобразить задание</h3>
                <p className="text-sm">Закройте карточку и откройте её снова. Если проблема повторяется, сообщите администратору.</p>
                <button type="button" onClick={() => this.setState({ error:false })} className="min-h-11 rounded-lg border border-current px-4 py-2 font-semibold">Повторить</button>
            </div>;
        }
        return this.props.children;
    }
}
