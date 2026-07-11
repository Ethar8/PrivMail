'use client';

import { Button } from '@/components/ui/button';
import { Reply, Forward, Archive, Trash2, Mail, MailOpen } from 'lucide-react';

interface EmailToolbarProps {
  onReply?: () => void;
  onForward?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  isRead?: boolean;
}

export function EmailToolbar({
  onReply,
  onForward,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  isRead,
}: EmailToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-4 py-2">
      {onReply && (
        <Button variant="ghost" size="icon" onClick={onReply} aria-label="Antworten">
          <Reply size={16} />
        </Button>
      )}
      {onForward && (
        <Button variant="ghost" size="icon" onClick={onForward} aria-label="Weiterleiten">
          <Forward size={16} />
        </Button>
      )}
      {onArchive && (
        <Button variant="ghost" size="icon" onClick={onArchive} aria-label="Archivieren">
          <Archive size={16} />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Löschen">
          <Trash2 size={16} />
        </Button>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onMarkUnread && isRead && (
          <Button variant="ghost" size="icon" onClick={onMarkUnread} aria-label="Als ungelesen markieren">
            <Mail size={16} />
          </Button>
        )}
        {onMarkRead && !isRead && (
          <Button variant="ghost" size="icon" onClick={onMarkRead} aria-label="Als gelesen markieren">
            <MailOpen size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
