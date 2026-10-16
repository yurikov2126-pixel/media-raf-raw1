import Avatar from '../Avatar.jsx';
import { resolveUrl } from '../../api/client.js';

export default function PhotoAlbum({ items, own, onlineSet, onOpen, onContext, onProfile }) {
    const sender = items[0].sender;
    return <div className={`mrr-v2-album-row ${own ? 'mrr-v2-album-own' : ''}`} aria-label={`Альбом: ${items.length} фотографий`}>
        {!own && <button type="button" onClick={onProfile} aria-label={sender.fullName}><Avatar user={sender} size={34} online={onlineSet?.has(sender.id)}/></button>}
        <div className="mrr-v2-album-body">
            {!own && <div className="mrr-v2-album-author">{sender.fullName}</div>}
            <div className="mrr-v2-album-grid">
                {items.map((item, index) => <button
                    type="button" key={item.id} id={`msg-${item.id}`}
                    className="mrr-v2-album-tile"
                    onClick={() => onOpen(item.id)}
                    onContextMenu={(event) => { event.preventDefault(); onContext(item, event); }}
                    aria-label={`Открыть фото ${index + 1} из ${items.length}`}>
                    <img src={resolveUrl(item.content)} alt={item.caption || `Фото ${index + 1}`} loading="lazy" />
                </button>)}
            </div>
            {items.some(item => item.caption) && <div className="mrr-v2-album-captions">
                {items.map((item, i) => item.caption && <div key={item.id}><b>{i + 1}.</b> {item.caption}</div>)}
            </div>}
            <div className="mrr-v2-album-time">{new Date(items[items.length - 1].createdAt).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
    </div>;
}
