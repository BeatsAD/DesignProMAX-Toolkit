import { ChevronRight, Megaphone } from 'lucide-react';
import type { Ref } from 'react';
import { MESSAGE_CATEGORIES, type PluginMessage } from '../../shared/message-center';

export function MessageNoticeBar({ message, unread = false, disabled = false, onOpen, buttonRef }: {
  message?: PluginMessage;
  unread?: boolean;
  disabled?: boolean;
  onOpen?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const label = MESSAGE_CATEGORIES.find((category) => category.id === message?.category)?.label;
  const title = message ? `${label}：${message.title}` : '查看消息公告';
  return (
    <button className="message-notice-bar" type="button" ref={buttonRef} onClick={onOpen} disabled={disabled || !onOpen}
      title={title} aria-label={`${title}${unread ? '，有未读消息' : ''}`} aria-haspopup="dialog">
      <span className="message-notice-icon"><Megaphone aria-hidden="true" size={15} />
        {unread ? <span className="message-unread-dot" /> : null}
      </span>
      <span className="message-notice-title">{title}</span>
      <ChevronRight className="message-notice-chevron" size={14} aria-hidden="true" />
    </button>
  );
}
