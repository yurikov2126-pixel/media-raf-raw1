import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import MessageBubble from './MessageBubble.jsx';

vi.mock('../Avatar.jsx', () => ({ default: () => null }));
vi.mock('../MessageText.jsx', () => ({ default: ({ text, content }) => <span>{text || content}</span> }));
vi.mock('../VoicePlayer.jsx', () => ({ default: () => null }));
vi.mock('../../api/client.js', () => ({ resolveUrl: (url) => url }));
vi.mock('../../stickers/pack.jsx', () => ({ Sticker: () => null }));

afterEach(() => cleanup());

const message = {
    id: 'msg-1', chatId: 'chat-1', senderId: 'user-1',
    sender: { id: 'user-1', fullName: 'Tester', username: 'tester' },
    type: 'text', content: 'Hello', reactions: [], createdAt: new Date().toISOString(),
};

function mount(onSwipeReply = vi.fn()) {
    const result = render(
        <MessageBubble m={message} isOwn highlight={false} onlineSet={new Set()}
            onSwipeReply={onSwipeReply} />
    );
    const bubble = result.container.querySelector('#msg-msg-1 .select-none');
    return { ...result, bubble, onSwipeReply };
}

function touch(x, y) { return { touches: [{ clientX: x, clientY: y }] }; }

describe('Messenger reply gestures', () => {
    it('replies once after a deliberate horizontal swipe', () => {
        const { bubble, onSwipeReply } = mount();
        fireEvent.touchStart(bubble, touch(10, 20));
        fireEvent.touchMove(bubble, touch(85, 22));
        fireEvent.touchEnd(bubble);
        expect(onSwipeReply).toHaveBeenCalledOnce();
        expect(onSwipeReply).toHaveBeenCalledWith(message);
    });

    it('does not trigger reply while vertically scrolling', () => {
        const { bubble, onSwipeReply } = mount();
        fireEvent.touchStart(bubble, touch(10, 20));
        fireEvent.touchMove(bubble, touch(15, 90));
        fireEvent.touchMove(bubble, touch(95, 95));
        fireEvent.touchEnd(bubble);
        expect(onSwipeReply).not.toHaveBeenCalled();
    });

    it('does not reply on a cancelled gesture', () => {
        const { bubble, onSwipeReply } = mount();
        fireEvent.touchStart(bubble, touch(10, 20));
        fireEvent.touchMove(bubble, touch(85, 20));
        fireEvent.touchCancel(bubble);
        expect(onSwipeReply).not.toHaveBeenCalled();
    });

    it('does not reply on a short swipe', () => {
        const { bubble, onSwipeReply } = mount();
        fireEvent.touchStart(bubble, touch(10, 20));
        fireEvent.touchMove(bubble, touch(35, 20));
        fireEvent.touchEnd(bubble);
        expect(onSwipeReply).not.toHaveBeenCalled();
    });
});
