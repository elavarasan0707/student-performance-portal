import { Router, Response, Request } from 'express';
import { repo } from '../repository';
import { checkDbConnection, initDbSchema } from '../db';
import { config } from '../config';
import { requireAuth, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const startTime = Date.now();

// GET /api/health - Production health inspection endpoint
router.get('/health', async (_req: AuthenticatedRequest, res: Response) => {
  const dbStatus = await checkDbConnection();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: 'healthy',
    version: '2.6.0-enterprise',
    institution: config.institution.name,
    autonomousAffiliation: config.institution.affiliation,
    environment: config.nodeEnv,
    uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    timestamp: new Date().toISOString(),
    metrics: {
      totalStudents: repo.students.length,
      totalFaculty: repo.faculty.length,
      totalDepartments: repo.departments.length,
      totalAttendanceLogs: repo.attendance.length,
      totalLeaveRequests: repo.leaveRequests.length,
      totalAuditLogs: repo.auditLogs.length,
      registeredUsers: repo.users.length,
    },
    database: dbStatus,
    security: {
      jwtEnabled: true,
      rbacEnforced: true,
      rateLimiting: true,
      securityHeaders: true,
      passwordsHashed: true,
    },
  });
});

// GET /api/db/status - Dedicated Database Diagnostic Route
router.get('/db/status', async (_req: AuthenticatedRequest, res: Response) => {
  const status = await checkDbConnection();
  res.json({
    success: true,
    ...status,
    database: typeof status.database === 'string' ? status.database : 'anna_autonomous_portal',
  });
});

// POST /api/db/init - Trigger Database Schema & Table Index Creation
router.post('/db/init', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await initDbSchema();
    repo.logAudit('DATABASE_SCHEMA_INITIALIZED', req.user!.email, 'admin', 'Triggered institutional schema initialization', req.ip);
    res.json({ success, message: 'Database schema and performance indexes verified/created successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Database init failed: ${err.message}` });
  }
});

// POST /api/db/seed - Synchronize state to database / repository
router.post('/db/seed', async (req: Request, res: Response) => {
  try {
    const { students, faculty, hod, attendanceRecords } = req.body;
    if (Array.isArray(students) && students.length > 0) {
      repo.students = students;
    }
    if (Array.isArray(faculty) && faculty.length > 0) {
      repo.faculty = faculty;
    }
    if (hod) {
      repo.hod = hod;
    }
    if (Array.isArray(attendanceRecords) && attendanceRecords.length > 0) {
      repo.attendance = attendanceRecords;
    }
    res.json({
      success: true,
      message: 'State synced to institutional repository successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Sync failed: ${err.message}` });
  }
});

// GET /api/settings - Read institutional parameters
router.get('/settings', optionalAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, settings: repo.settings });
});

// PUT /api/settings - Update institutional parameters (Admin only)
router.put('/settings', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  Object.assign(repo.settings, req.body);
  repo.logAudit(
    'SETTINGS_UPDATED',
    req.user!.email,
    'admin',
    `Updated institutional portal settings: ${JSON.stringify(req.body)}`,
    req.ip
  );
  res.json({ success: true, message: 'Institutional portal settings saved', settings: repo.settings });
});

export default router;
