const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const idKey = (path, file) => 'editorial-resume:' + path + ':' + file.name + ':' + file.size + ':' + file.lastModified;

async function jsonRequest(url, token, options = {}) {
    const response = await fetch(API + url, { ...options, headers: { Authorization:'Bearer ' + token, ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'Ошибка загрузки'); error.status = response.status; throw error; }
    return data;
}

function sendChunk(url, token, chunk, offset, progress, signal) {
    return new Promise((resolve,reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PATCH', API + url);
        xhr.setRequestHeader('Authorization','Bearer ' + token);
        xhr.setRequestHeader('Content-Type','application/octet-stream');
        xhr.setRequestHeader('Upload-Offset', String(offset));
        const abort = () => xhr.abort();
        signal?.addEventListener('abort',abort,{once:true});
        xhr.upload.onprogress = event => { if (event.lengthComputable) progress(offset + event.loaded); };
        xhr.onload = () => {
            signal?.removeEventListener('abort',abort);
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch { /* response not JSON */ }
            if (xhr.status >= 200 && xhr.status < 300) resolve(data);
            else { const error = new Error(data.error || 'Не удалось отправить блок'); error.status = xhr.status; reject(error); }
        };
        xhr.onerror = () => { signal?.removeEventListener('abort',abort); reject(new Error('Сетевая ошибка')); };
        xhr.onabort = () => { signal?.removeEventListener('abort',abort); reject(new DOMException('Загрузка приостановлена','AbortError')); };
        xhr.send(chunk);
    });
}

/**
 * Chunked uploads persist their server session ID in localStorage.
 * If the network drops, each retry rechecks the server offset before sending.
 * Retains the same file reference while this page is open; after a reload the
 * user should choose the same local file again to resume.
 */
export async function uploadEditorialResumable({ path, file, token, caption = '', onProgress = () => {}, signal }) {
    const key = idKey(path,file);
    let id = localStorage.getItem(key);
    let tries = 0;
    while (true) {
        if (signal?.aborted) throw new DOMException('Загрузка приостановлена','AbortError');
        try {
            let state;
            if (id) {
                try { state = await jsonRequest(path + '/uploads/' + id,token); }
                catch (error) { if (error.status !== 404) throw error; localStorage.removeItem(key); id = null; }
            }
            if (!id) {
                state = await jsonRequest(path + '/uploads',token,{ method:'POST',body:JSON.stringify({ name:file.name,mimeType:file.type || 'application/octet-stream',size:file.size,caption }) });
                id = state.id;
                localStorage.setItem(key,id);
            }
            if (state.state === 'done') {
                localStorage.removeItem(key);
                onProgress(100);
                return state.result;
            }
            let offset = state.offset;
            const chunkSize = state.chunkSize || 2 * 1024 * 1024;
            onProgress(Math.round(offset / file.size * 100));
            while (offset < file.size) {
                if (signal?.aborted) throw new DOMException('Загрузка приостановлена','AbortError');
                const next = Math.min(offset + chunkSize,file.size);
                const result = await sendChunk(path + '/uploads/' + id,token,file.slice(offset,next),offset,bytes => onProgress(Math.min(99,Math.round(bytes / file.size * 100))),signal);
                offset = result.offset;
                onProgress(Math.min(99,Math.round(offset / file.size * 100)));
            }
            const completed = await jsonRequest(path + '/uploads/' + id + '/finish',token,{method:'POST'});
            localStorage.removeItem(key);
            onProgress(100);
            return completed.file;
        } catch (error) {
            if (signal?.aborted || error.name === 'AbortError' || [400,401,403,413,415].includes(error.status)) throw error;
            tries++;
            if (tries > 5) throw new Error('Сеть недоступна. Прогресс сохранён; выберите тот же файл и повторите загрузку.');
            await sleep(Math.min(1000 * 2 ** (tries-1), 10000));
        }
    }
}
