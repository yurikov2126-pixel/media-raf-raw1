import { useEffect, useState } from 'react';
export default function AttachmentPreview({ file }) {
 const [url, setUrl] = useState('');
 useEffect(() => {
   if (!file?.type.startsWith('image/')) { setUrl(''); return; }
   const next = URL.createObjectURL(file);
   setUrl(next);
   return () => URL.revokeObjectURL(next);
 }, [file]);
 if (url) return <img src={url} alt={file.name} className="h-16 w-full rounded-md object-cover mb-1" />;
 return <div className="h-16 grid place-items-center text-2xl" aria-hidden="true">{file.type.startsWith('video/') ? '🎥' : '📎'}</div>;
}
