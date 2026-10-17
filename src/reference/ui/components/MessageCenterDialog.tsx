import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Megaphone, X } from 'lucide-react';
import { APP_VERSION } from '../../shared/constants';
import { MESSAGE_CATEGORIES, messagesInCategory, type MessageCategory, type PluginMessage } from '../../shared/message-center';
import { Button } from './ui';

export function MessageCenterDialog({ messages, initialMessageId, onRead, onClose, closing = false }: {
  messages: readonly PluginMessage[];
  initialMessageId?: string;
  onRead: (id: string) => void;
  onClose: () => void;
  closing?: boolean;
}) {
  const initial = messages.find((message) => message.id === initialMessageId);
  const [category, setCategory] = useState<MessageCategory>(initial?.category ?? 'announcement');
  const [expanded, setExpanded] = useState<Partial<Record<MessageCategory, string | null>>>(() => (
    Object.fromEntries(MESSAGE_CATEGORIES.map(({ id }) => [id,
      initial?.category === id ? initial.id : messagesInCategory(messages, id)[0]?.id ?? null]))
  ));
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<MessageCategory, HTMLButtonElement | null>>>({});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const prefix = useId();
  const visible = messagesInCategory(messages, category);
  const active = visible.find((message) => message.id === expanded[category]);

  useEffect(() => {
    if (active) onRead(active.id);
  }, [active?.id, onRead]);

  useEffect(() => {
    const target = active ? document.getElementById(`${prefix}-${active.id}`) : undefined;
    // Keep a targeted older record in view without scrolling the plugin page.
    if (target && scrollRef.current) scrollRef.current.scrollTop = visible[0]?.id === active?.id
      ? 0 : Math.max(0, target.offsetTop - scrollRef.current.offsetTop);
  }, [category, active?.id, prefix]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); onCloseRef.current(); return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])];
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); previousFocus?.focus(); };
  }, []);

  function changeCategory(next: MessageCategory) {
    setCategory(next);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  return (
    <div className="modal-backdrop message-center-backdrop">
      <div className="message-center-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-busy={closing} tabIndex={-1} ref={dialogRef}>
        <header className="message-center-header">
          <h2 id={titleId}><Megaphone size={18} aria-hidden="true" />消息公告</h2>
          <button className="icon-btn" type="button" ref={closeRef} aria-label="关闭消息公告" title="关闭"
            disabled={closing} onClick={onClose}><X size={16} aria-hidden="true" /></button>
        </header>
        <div className="message-center-tabs" role="tablist" aria-label="消息分类">
          {MESSAGE_CATEGORIES.map((item, index) => (
            <button key={item.id} ref={(node) => { tabRefs.current[item.id] = node; }} type="button" role="tab"
              id={`${prefix}-tab-${item.id}`} aria-controls={`${prefix}-panel`} aria-selected={item.id === category}
              tabIndex={item.id === category ? 0 : -1} disabled={closing} onClick={() => changeCategory(item.id)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === 'ArrowRight') next = (index + 1) % MESSAGE_CATEGORIES.length;
                else if (event.key === 'ArrowLeft') next = (index + MESSAGE_CATEGORIES.length - 1) % MESSAGE_CATEGORIES.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = MESSAGE_CATEGORIES.length - 1;
                else return;
                event.preventDefault(); changeCategory(MESSAGE_CATEGORIES[next].id); tabRefs.current[MESSAGE_CATEGORIES[next].id]?.focus();
              }}>{item.label}</button>
          ))}
        </div>
        <div className="message-center-scroll" ref={scrollRef} role="tabpanel" id={`${prefix}-panel`}
          aria-labelledby={`${prefix}-tab-${category}`} tabIndex={0}>
          {visible.length === 0 ? <p className="message-center-empty">暂无内容</p> : null}
          {visible.map((message) => {
            const isExpanded = message.id === expanded[category];
            const bodyId = `${prefix}-body-${message.id}`;
            return <article key={message.id} id={`${prefix}-${message.id}`} className="message-center-item">
              <h3 className="message-item-heading">
                <button type="button" disabled={closing} aria-expanded={isExpanded} aria-controls={bodyId}
                  onClick={() => setExpanded((current) => ({ ...current, [category]: isExpanded ? null : message.id }))}>
                  <span className="message-item-copy">
                    {category === 'release' ? <span className="message-version-row"><strong>v{message.version}</strong>
                      {message.version === APP_VERSION ? <span className="message-current-version">当前版本</span> : null}</span> : null}
                    <span className="message-item-title">{message.title}</span>
                    <span className="message-item-date">{message.dateKind === 'development' ? '开发记录日期：' : ''}{message.publishedAt?.replace(/-/g, '.') ?? '日期待补充'}</span>
                  </span>
                  <ChevronDown size={15} className={isExpanded ? 'is-expanded' : ''} aria-hidden="true" />
                </button>
              </h3>
              <div id={bodyId} hidden={!isExpanded} className="message-item-body">
                {isExpanded ? message.sections.map((section, index) => {
                  const List = section.ordered ? 'ol' : 'ul';
                  return <section key={index}>
                    {section.heading ? <h4>{section.heading}</h4> : null}
                    {section.paragraphs?.map((paragraph, line) => <p key={line}>{paragraph}</p>)}
                    {section.items?.length ? <List>{section.items.map((text, line) => <li key={line}>{text}</li>)}</List> : null}
                  </section>;
                }) : null}
              </div>
            </article>;
          })}
        </div>
        <footer className="message-center-footer"><Button variant="primary" disabled={closing} onClick={onClose}>知道了</Button></footer>
      </div>
    </div>
  );
}
