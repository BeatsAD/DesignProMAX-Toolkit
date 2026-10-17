export const MESSAGE_CATEGORIES = [
  { id: 'announcement', label: '插件公告' },
  { id: 'release', label: '更新信息' },
  { id: 'tip', label: '使用技巧' }
] as const;

export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number]['id'];
export type MessageSection = {
  heading?: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  ordered?: boolean;
};
export type PluginMessage = {
  id: string;
  category: MessageCategory;
  title: string;
  publishedAt: string | null;
  /** Development dates are identified as such instead of implying public release. */
  dateKind?: 'development';
  version?: string;
  notify: boolean;
  sections: readonly MessageSection[];
};
export type MessageReadState = { readIds: string[]; welcomeAcknowledged?: true };

export function normalizeMessageReadState(value: unknown): MessageReadState {
  const ids = value && typeof value === 'object' ? (value as Partial<MessageReadState>).readIds : undefined;
  return { readIds: Array.isArray(ids)
    ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(id)))]
    : [],
    ...(value && typeof value === 'object' && (value as MessageReadState).welcomeAcknowledged === true
      ? { welcomeAcknowledged: true as const } : {}) };
}

export function messagesInCategory(messages: readonly PluginMessage[], category: MessageCategory): PluginMessage[] {
  return messages.filter((message) => message.category === category).sort((a, b) => {
    if (category === 'release') {
      const left = (a.version ?? '').split('.').map(Number);
      const right = (b.version ?? '').split('.').map(Number);
      for (let part = 0; part < 3; part += 1) {
        const difference = (right[part] || 0) - (left[part] || 0);
        if (difference) return difference;
      }
    }
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  });
}

export function selectNoticeMessage(messages: readonly PluginMessage[], readIds: readonly string[]): PluginMessage | undefined {
  const read = new Set(readIds);
  for (const category of MESSAGE_CATEGORIES) {
    const unread = messagesInCategory(messages, category.id).find((message) => message.notify && !read.has(message.id));
    if (unread) return unread;
  }
  for (const category of MESSAGE_CATEGORIES) {
    const latest = messagesInCategory(messages, category.id)[0];
    if (latest) return latest;
  }
}
