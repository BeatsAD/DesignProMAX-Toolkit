import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diagnosticStore } from '../../shared/diagnostics';
import { messagesInCategory, normalizeMessageReadState, selectNoticeMessage, type MessageReadState } from '../../shared/message-center';
import { pluginMessages, pluginMessageIds } from '../content/messages';
import type { usePluginBridge } from './usePluginBridge';

type Requester = ReturnType<typeof usePluginBridge>['request'];

export function useMessageCenter(request: Requester) {
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [welcomeStatus, setWelcomeStatus] = useState<'loading' | 'pending' | 'acknowledged' | 'unavailable'>('loading');
  const welcomeAcknowledged = useRef(false);
  const sessionRead = useRef(new Set<string>());
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    let active = true;
    const frame = requestAnimationFrame(() => {
      void Promise.resolve(request<MessageReadState>('GET_MESSAGE_READ_STATE')).then((state) => {
        if (!active) return;
        const saved = normalizeMessageReadState(state);
        for (const id of saved.readIds) sessionRead.current.add(id);
        setReadIds([...sessionRead.current]);
        welcomeAcknowledged.current ||= saved.welcomeAcknowledged === true;
        // Failed or malformed reads cannot establish that this is a first run.
        setWelcomeStatus(welcomeAcknowledged.current ? 'acknowledged'
          : Array.isArray(state?.readIds) ? 'pending' : 'unavailable');
      }).catch(() => {
        // Read-state failure does not block local messages or the homepage.
        if (active) setWelcomeStatus(welcomeAcknowledged.current ? 'acknowledged' : 'unavailable');
      }).finally(() => { if (active) setLoaded(true); });
    });
    return () => { active = false; alive.current = false; cancelAnimationFrame(frame); };
  }, [request]);

  const acknowledgeWelcome = useCallback(async () => {
    if (welcomeAcknowledged.current) return;
    const saved = normalizeMessageReadState(await request<MessageReadState>('ACKNOWLEDGE_MESSAGE_WELCOME'));
    if (!saved.welcomeAcknowledged) throw new Error('公告确认未保存');
    welcomeAcknowledged.current = true;
    for (const id of saved.readIds) sessionRead.current.add(id);
    if (alive.current) {
      setWelcomeStatus('acknowledged');
      setReadIds([...sessionRead.current]);
    }
  }, [request]);

  const markRead = useCallback((id: string) => {
    if (!pluginMessageIds.has(id) || sessionRead.current.has(id)) return;
    sessionRead.current.add(id);
    setReadIds([...sessionRead.current]);
    void Promise.resolve(request<MessageReadState>('MARK_MESSAGE_READ', { id })).then((state) => {
      for (const saved of normalizeMessageReadState(state).readIds) sessionRead.current.add(saved);
      if (alive.current) setReadIds([...sessionRead.current]);
    }).catch(() => {
      diagnosticStore.recordContext({ event: 'message-center:read-save', result: 'error', message: '消息已读状态未保存' });
    });
  }, [request]);

  const notice = useMemo(() => selectNoticeMessage(pluginMessages, readIds), [readIds]);
  const welcomeMessage = useMemo(() => messagesInCategory(pluginMessages, 'announcement')[0], []);
  return { messages: pluginMessages, notice, readIds, markRead, welcomeStatus, welcomeMessage, acknowledgeWelcome,
    unread: loaded && Boolean(notice?.notify && !readIds.includes(notice.id)) };
}
