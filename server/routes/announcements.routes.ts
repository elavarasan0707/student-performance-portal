import { Router, Response } from 'express';
import { repo } from '../repository';
import { Announcement, NotificationItem } from '../../src/types';
import { requireAuth, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/announcements - List announcements
router.get('/', optionalAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: repo.announcements, total: repo.announcements.length });
});

// POST /api/announcements - Publish circular/announcement
router.post('/', requireAuth, requireRole('admin', 'hod', 'faculty'), async (req: AuthenticatedRequest, res: Response) => {
  const { title, content, targetAudience = 'All', priority = 'Normal', category = 'Academic' } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and content are required' });
  }

  const newAnn: Announcement = {
    id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    content,
    author: `${req.user?.name || 'Staff'} (${(req.user?.role || 'admin').toUpperCase()})`,
    authorRole: (req.user?.role || 'admin') as 'faculty' | 'hod' | 'admin',
    targetAudience,
    priority,
    category,
    date: new Date().toISOString().split('T')[0],
  };

  // Persist to TiDB Cloud & in-memory
  await repo.persistAnnouncement(newAnn);

  // Broadcast in-app notification
  const broadcastNotif: NotificationItem = {
    id: `notif-${Date.now()}`,
    targetRole: 'all',
    title: `Notice: ${newAnn.title}`,
    message: newAnn.content.length > 100 ? `${newAnn.content.substring(0, 97)}...` : newAnn.content,
    type: newAnn.priority === 'Urgent' ? 'alert' : 'info',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false,
    link: 'announcements',
  };
  repo.notifications.unshift(broadcastNotif);

  repo.logAudit(
    'ANNOUNCEMENT_PUBLISHED',
    req.user?.email || 'admin@college.edu',
    req.user?.role || 'admin',
    `Published circular: "${newAnn.title}" for ${targetAudience}`,
    req.ip
  );

  res.status(201).json({ success: true, message: 'Announcement published and saved successfully', data: newAnn });
});

// DELETE /api/announcements/:id - Remove announcement
router.delete('/:id', requireAuth, requireRole('admin', 'hod', 'faculty'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const idx = repo.announcements.findIndex((a) => a.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Announcement not found' });
  }

  const removed = repo.announcements[idx];
  await repo.removeAnnouncement(id);

  repo.logAudit(
    'ANNOUNCEMENT_DELETED',
    req.user?.email || 'admin@college.edu',
    req.user?.role || 'admin',
    `Removed circular: "${removed.title}"`,
    req.ip
  );

  res.json({ success: true, message: 'Announcement deleted and removed from database' });
});

export default router;
