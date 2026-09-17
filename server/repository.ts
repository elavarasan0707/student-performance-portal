import {
  Student,
  Faculty,
  HOD,
  Admin,
  Department,
  Subject,
  AttendanceRecord,
  LeaveRequest,
  Announcement,
  NotificationItem,
  FeeRecord,
  AuditLog,
} from '../src/types';
import {
  INITIAL_STUDENTS,
  INITIAL_FACULTY,
  INITIAL_HOD,
  INITIAL_ADMIN,
  INITIAL_DEPARTMENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_FEES,
  INITIAL_AUDIT_LOGS,
  SUBJECT_CATALOG,
  generateInitialAttendanceLogs,
} from '../src/data/initialData';
import { getMySqlPool, seedTiDbWithInitialData } from './db';

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'faculty' | 'hod' | 'admin';
  name: string;
  status: 'Active' | 'Inactive';
  lastLogin?: string;
  createdAt: string;
}

function safeJson(val: any, fallback: any = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

class InstitutionalRepository {
  public users: UserAccount[] = [
    {
      id: 'ADM001',
      email: 'kasthuricse23@sasurie.com',
      passwordHash: 'kasthu123',
      role: 'admin',
      name: 'Kasthuri',
      status: 'Active',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLogin: new Date().toISOString(),
    },
    {
      id: 'admin',
      email: 'admin@college.edu',
      passwordHash: 'admin123',
      role: 'admin',
      name: 'Kasthuri',
      status: 'Active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'FAC001',
      email: 'r.sharma@college.edu',
      passwordHash: 'faculty123',
      role: 'faculty',
      name: 'Dr. R. Sharma',
      status: 'Active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'HOD001',
      email: 'hod.cse@college.edu',
      passwordHash: 'hod123',
      role: 'hod',
      name: 'Dr. M. Sundararajan',
      status: 'Active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '2023CSE001',
      email: 'aakash.varma@student.college.edu',
      passwordHash: 'student123',
      role: 'student',
      name: 'Aakash Varma',
      status: 'Active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  public students: Student[] = [...INITIAL_STUDENTS];
  public faculty: Faculty[] = [...INITIAL_FACULTY];
  public hod: HOD = { ...INITIAL_HOD };
  public admin: Admin = { ...INITIAL_ADMIN };
  public departments: Department[] = [...INITIAL_DEPARTMENTS];
  public subjects: Subject[] = [...SUBJECT_CATALOG];
  public attendance: AttendanceRecord[] = generateInitialAttendanceLogs();
  public leaveRequests: LeaveRequest[] = [...INITIAL_LEAVE_REQUESTS];
  public announcements: Announcement[] = [...INITIAL_ANNOUNCEMENTS];
  public notifications: NotificationItem[] = [...INITIAL_NOTIFICATIONS];
  public fees: FeeRecord[] = [...INITIAL_FEES];
  public auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  public settings: Record<string, any> = {
    institutionName: 'Park College of Engineering and Technology',
    autonomousAffiliation: 'Autonomous Institution Affiliated to Anna University, Chennai',
    academicYear: '2026-2027',
    currentSemester: 5,
    attendanceThreshold: 75,
    allowStudentProfileEdit: true,
    allowLeaveSubmission: true,
  };

  private initialized = false;

  // Initialize and load from TiDB / MySQL if available
  public async initFromDb(): Promise<boolean> {
    const pool = getMySqlPool();
    if (!pool) {
      return false;
    }

    try {
      // Check students count
      const [sRows]: any = await pool.query('SELECT COUNT(*) as count FROM students');
      const studentCount = Number(sRows[0]?.count || 0);

      if (studentCount === 0) {
        console.log('[Repository] TiDB Cloud database is empty, seeding initial data...');
        const conn = await pool.getConnection();
        try {
          await seedTiDbWithInitialData(conn);
        } finally {
          conn.release();
        }
      }

      // Load Students
      const [studentsResult]: any = await pool.query('SELECT * FROM students ORDER BY reg_no ASC');
      if (studentsResult && studentsResult.length > 0) {
        this.students = studentsResult.map((r: any) => ({
          regNo: r.reg_no,
          id: r.id || r.reg_no,
          name: r.name,
          department: r.department,
          year: Number(r.year || 3),
          semester: Number(r.semester || 5),
          section: r.section || 'A',
          email: r.email,
          phone: r.phone || '',
          dob: r.dob || '',
          bloodGroup: r.blood_group || '',
          facultyAdvisor: r.faculty_advisor || '',
          mentor: r.mentor || '',
          parentName: r.parent_name || '',
          parentPhone: r.parent_phone || '',
          address: r.address || '',
          cgpa: Number(r.cgpa || 0),
          currentSemesterGpa: Number(r.current_semester_gpa || 0),
          subjects: safeJson(r.subjects, []),
          marks: safeJson(r.marks, {}),
          assignments: safeJson(r.assignments, []),
          overallAttendance: safeJson(r.overall_attendance, { present: 0, absent: 0, od: 0, total: 0, percentage: 0 }),
          subjectAttendance: safeJson(r.subject_attendance, {}),
          performanceRating: r.performance_rating || 'Good',
          facultyRemarks: r.faculty_remarks || '',
          mentorNotes: safeJson(r.mentor_notes, []),
          avatar: r.avatar || '',
          accountStatus: r.account_status || 'Active',
        }));
      }

      // Load Faculty
      const [facResult]: any = await pool.query('SELECT * FROM faculty ORDER BY name ASC');
      if (facResult && facResult.length > 0) {
        this.faculty = facResult.map((r: any) => ({
          id: r.id,
          name: r.name,
          designation: r.designation,
          department: r.department,
          email: r.email,
          phone: r.phone || '',
          cabin: r.cabin || '',
          qualification: r.qualification || '',
          experience: r.experience || '',
          officeHours: r.office_hours || '',
          specialization: r.specialization || '',
          bio: r.bio || '',
          assignedMenteeSection: r.assigned_mentee_section || 'A',
          assignedClasses: safeJson(r.assigned_classes, []),
          avatar: r.avatar || '',
          details: safeJson(r.details, {}),
        }));
      }

      // Load HOD
      const [hodResult]: any = await pool.query('SELECT * FROM hod LIMIT 1');
      if (hodResult && hodResult.length > 0) {
        const h = hodResult[0];
        this.hod = {
          id: h.id,
          name: h.name,
          designation: h.designation,
          department: h.department,
          email: h.email,
          phone: h.phone || '',
          cabin: h.cabin || '',
          qualification: h.qualification || '',
          officeHours: h.office_hours || '',
          specialization: h.specialization || '',
          message: h.message || '',
          avatar: h.avatar || '',
        };
      }

      // Load Attendance Records (last 1000)
      const [attResult]: any = await pool.query('SELECT * FROM attendance_records ORDER BY date DESC, created_at DESC LIMIT 1000');
      if (attResult && attResult.length > 0) {
        this.attendance = attResult.map((r: any) => ({
          id: r.id,
          date: r.date,
          regNo: r.reg_no,
          studentName: r.student_name,
          subjectCode: r.subject_code,
          subjectName: r.subject_name,
          section: r.section,
          year: Number(r.year),
          status: r.status,
          markedBy: r.marked_by,
          period: Number(r.period || 1),
        }));
      }

      // Load Leave Requests
      const [leaveResult]: any = await pool.query('SELECT * FROM leave_requests ORDER BY applied_on DESC');
      if (leaveResult && leaveResult.length > 0) {
        this.leaveRequests = leaveResult.map((r: any) => ({
          id: r.id,
          studentRegNo: r.student_reg_no,
          studentName: r.student_name,
          department: r.department,
          year: Number(r.year),
          section: r.section,
          startDate: r.start_date,
          endDate: r.end_date,
          daysCount: Number(r.days_count),
          reason: r.reason,
          type: r.type,
          status: r.status,
          appliedOn: r.applied_on,
          reviewedBy: r.reviewed_by || undefined,
          reviewedOn: r.reviewed_on || undefined,
          reviewerComments: r.reviewer_comments || undefined,
        }));
      }

      // Load Announcements
      const [annResult]: any = await pool.query('SELECT * FROM announcements ORDER BY date DESC');
      if (annResult && annResult.length > 0) {
        this.announcements = annResult.map((r: any) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          author: r.author,
          authorRole: r.author_role,
          targetAudience: r.target_audience,
          priority: r.priority,
          date: r.date,
          category: r.category,
        }));
      }

      // Load Fees
      const [feesResult]: any = await pool.query('SELECT * FROM fees');
      if (feesResult && feesResult.length > 0) {
        this.fees = feesResult.map((r: any) => ({
          id: r.id,
          studentRegNo: r.student_reg_no,
          studentName: r.student_name,
          academicYear: r.academic_year,
          semester: Number(r.semester),
          tuitionFee: Number(r.tuition_fee),
          developmentFee: Number(r.development_fee),
          examFee: Number(r.exam_fee),
          totalFee: Number(r.total_fee),
          paidAmount: Number(r.paid_amount),
          dueAmount: Number(r.due_amount),
          status: r.status,
          noDueApproved: Boolean(r.no_due_approved),
          lastPaymentDate: r.last_payment_date || undefined,
          receiptNumber: r.receipt_number || undefined,
        }));
      }

      // Load Audit Logs (latest 300)
      const [auditResult]: any = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 300');
      if (auditResult && auditResult.length > 0) {
        this.auditLogs = auditResult.map((r: any) => ({
          id: r.id,
          action: r.action,
          performedBy: r.performed_by,
          userRole: r.user_role,
          details: r.details,
          timestamp: r.timestamp,
          ipAddress: r.ip_address,
        }));
      }

      this.initialized = true;
      console.log(`[Repository] Successfully loaded from TiDB Cloud: ${this.students.length} students, ${this.faculty.length} faculty, ${this.attendance.length} attendance records.`);
      return true;
    } catch (err: any) {
      console.error('[Repository] Failed to load data from TiDB Cloud:', err.message);
      return false;
    }
  }

  // Persist Student to TiDB Cloud and in-memory
  public async persistStudent(student: Student): Promise<void> {
    // 1. In-memory update
    const idx = this.students.findIndex((s) => s.regNo.toUpperCase() === student.regNo.toUpperCase());
    if (idx >= 0) {
      this.students[idx] = student;
    } else {
      this.students.push(student);
    }

    // Ensure login user exists
    const userIdx = this.users.findIndex((u) => u.id.toUpperCase() === student.regNo.toUpperCase());
    if (userIdx >= 0) {
      this.users[userIdx].name = student.name;
      this.users[userIdx].email = student.email;
    } else {
      this.users.push({
        id: student.regNo,
        email: student.email,
        passwordHash: 'student123',
        role: 'student',
        name: student.name,
        status: 'Active',
        createdAt: new Date().toISOString(),
      });
    }

    // 2. TiDB Cloud persistence
    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO students (
            reg_no, id, name, department, year, semester, section, email, phone, dob, blood_group,
            faculty_advisor, mentor, parent_name, parent_phone, address, cgpa, current_semester_gpa,
            subjects, marks, assignments, overall_attendance, subject_attendance, performance_rating,
            faculty_remarks, mentor_notes, avatar, account_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), department=VALUES(department), year=VALUES(year), semester=VALUES(semester),
            section=VALUES(section), email=VALUES(email), phone=VALUES(phone), dob=VALUES(dob),
            blood_group=VALUES(blood_group), faculty_advisor=VALUES(faculty_advisor), mentor=VALUES(mentor),
            parent_name=VALUES(parent_name), parent_phone=VALUES(parent_phone), address=VALUES(address),
            cgpa=VALUES(cgpa), current_semester_gpa=VALUES(current_semester_gpa), subjects=VALUES(subjects),
            marks=VALUES(marks), assignments=VALUES(assignments), overall_attendance=VALUES(overall_attendance),
            subject_attendance=VALUES(subject_attendance), performance_rating=VALUES(performance_rating),
            faculty_remarks=VALUES(faculty_remarks), mentor_notes=VALUES(mentor_notes), avatar=VALUES(avatar),
            account_status=VALUES(account_status);`,
          [
            student.regNo,
            student.id || student.regNo,
            student.name,
            student.department,
            student.year,
            student.semester,
            student.section,
            student.email,
            student.phone || '',
            student.dob || '',
            student.bloodGroup || '',
            student.facultyAdvisor || '',
            student.mentor || '',
            student.parentName || '',
            student.parentPhone || '',
            student.address || '',
            student.cgpa || 0,
            student.currentSemesterGpa || 0,
            JSON.stringify(student.subjects || []),
            JSON.stringify(student.marks || {}),
            JSON.stringify(student.assignments || []),
            JSON.stringify(student.overallAttendance || {}),
            JSON.stringify(student.subjectAttendance || {}),
            student.performanceRating || 'Good',
            student.facultyRemarks || '',
            JSON.stringify(student.mentorNotes || []),
            student.avatar || '',
            student.accountStatus || 'Active',
          ]
        );

        // Also ensure user login is saved to TiDB
        await pool.query(
          `INSERT INTO users (id, email, password_hash, role, name, status)
           VALUES (?, ?, ?, 'student', ?, 'Active')
           ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email);`,
          [student.regNo, student.email, 'student123', student.name]
        );

        console.log(`[Repository] Persisted student ${student.regNo} (${student.name}) to TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to persist student ${student.regNo} to TiDB Cloud:`, err.message);
      }
    }
  }

  // Remove Student from TiDB Cloud and in-memory
  public async removeStudent(regNo: string): Promise<boolean> {
    const idx = this.students.findIndex((s) => s.regNo.toUpperCase() === regNo.toUpperCase());
    if (idx >= 0) {
      this.students.splice(idx, 1);
    }
    const userIdx = this.users.findIndex((u) => u.id.toUpperCase() === regNo.toUpperCase());
    if (userIdx >= 0) {
      this.users.splice(userIdx, 1);
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query('DELETE FROM students WHERE UPPER(reg_no) = UPPER(?)', [regNo]);
        await pool.query('DELETE FROM users WHERE UPPER(id) = UPPER(?)', [regNo]);
        console.log(`[Repository] Deleted student ${regNo} from TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to delete student ${regNo} from TiDB Cloud:`, err.message);
      }
    }

    return true;
  }

  // Persist Faculty to TiDB Cloud and in-memory
  public async persistFaculty(fac: Faculty): Promise<void> {
    const idx = this.faculty.findIndex((f) => f.id.toUpperCase() === fac.id.toUpperCase());
    if (idx >= 0) {
      this.faculty[idx] = fac;
    } else {
      this.faculty.push(fac);
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO faculty (
            id, name, designation, department, email, phone, cabin, qualification, experience,
            office_hours, specialization, bio, assigned_mentee_section, assigned_classes, avatar, details
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), designation=VALUES(designation), department=VALUES(department),
            email=VALUES(email), phone=VALUES(phone), cabin=VALUES(cabin), qualification=VALUES(qualification),
            experience=VALUES(experience), office_hours=VALUES(office_hours), specialization=VALUES(specialization),
            bio=VALUES(bio), assigned_mentee_section=VALUES(assigned_mentee_section),
            assigned_classes=VALUES(assigned_classes), avatar=VALUES(avatar), details=VALUES(details);`,
          [
            fac.id,
            fac.name,
            fac.designation,
            fac.department,
            fac.email,
            fac.phone || '',
            fac.cabin || '',
            fac.qualification || '',
            fac.experience || '',
            fac.officeHours || '',
            fac.specialization || '',
            fac.bio || '',
            fac.assignedMenteeSection || 'A',
            JSON.stringify(fac.assignedClasses || []),
            fac.avatar || '',
            JSON.stringify(fac.details || {}),
          ]
        );

        await pool.query(
          `INSERT INTO users (id, email, password_hash, role, name, status)
           VALUES (?, ?, ?, 'faculty', ?, 'Active')
           ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email);`,
          [fac.id, fac.email, 'faculty123', fac.name]
        );
        console.log(`[Repository] Persisted faculty ${fac.id} (${fac.name}) to TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to persist faculty ${fac.id} to TiDB Cloud:`, err.message);
      }
    }
  }

  // Remove Faculty
  public async removeFaculty(id: string): Promise<boolean> {
    const idx = this.faculty.findIndex((f) => f.id.toUpperCase() === id.toUpperCase());
    if (idx >= 0) {
      this.faculty.splice(idx, 1);
    }
    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query('DELETE FROM faculty WHERE UPPER(id) = UPPER(?)', [id]);
        await pool.query('DELETE FROM users WHERE UPPER(id) = UPPER(?)', [id]);
        console.log(`[Repository] Deleted faculty ${id} from TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to delete faculty ${id} from TiDB Cloud:`, err.message);
      }
    }
    return true;
  }

  // Persist HOD to TiDB Cloud and in-memory
  public async persistHOD(hod: HOD): Promise<void> {
    this.hod = { ...hod };
    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO hod (id, name, designation, department, email, phone, cabin, qualification, office_hours, specialization, message, avatar)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name=VALUES(name), designation=VALUES(designation), department=VALUES(department),
             email=VALUES(email), phone=VALUES(phone), cabin=VALUES(cabin), qualification=VALUES(qualification),
             office_hours=VALUES(office_hours), specialization=VALUES(specialization),
             message=VALUES(message), avatar=VALUES(avatar);`,
          [
            hod.id,
            hod.name,
            hod.designation,
            hod.department,
            hod.email,
            hod.phone || '',
            hod.cabin || '',
            hod.qualification || '',
            hod.officeHours || '',
            hod.specialization || '',
            hod.message || '',
            hod.avatar || '',
          ]
        );
        console.log(`[Repository] Persisted HOD to TiDB Cloud.`);
      } catch (err: any) {
        console.error('[Repository] Failed to persist HOD to TiDB Cloud:', err.message);
      }
    }
  }

  // Persist Attendance Batch to TiDB Cloud and in-memory
  public async persistAttendanceBatch(records: AttendanceRecord[]): Promise<void> {
    this.attendance.unshift(...records);

    // Recalculate attendance for affected students
    const uniqueRegNos = Array.from(new Set(records.map((r) => r.regNo)));
    for (const regNo of uniqueRegNos) {
      this.recalculateStudentAttendance(regNo);
      const student = this.students.find((s) => s.regNo.toUpperCase() === regNo.toUpperCase());
      if (student) {
        await this.persistStudent(student);
      }
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        for (const r of records) {
          await pool.query(
            `INSERT INTO attendance_records (id, date, reg_no, student_name, subject_code, subject_name, section, year, status, marked_by, period)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status=VALUES(status);`,
            [r.id, r.date, r.regNo, r.studentName, r.subjectCode, r.subjectName, r.section, r.year, r.status, r.markedBy, r.period || 1]
          );
        }
        console.log(`[Repository] Persisted ${records.length} attendance records to TiDB Cloud.`);
      } catch (err: any) {
        console.error('[Repository] Failed to persist attendance batch to TiDB Cloud:', err.message);
      }
    }
  }

  // Persist Leave Request
  public async persistLeaveRequest(req: LeaveRequest): Promise<void> {
    const idx = this.leaveRequests.findIndex((l) => l.id === req.id);
    if (idx >= 0) {
      this.leaveRequests[idx] = req;
    } else {
      this.leaveRequests.unshift(req);
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO leave_requests (
            id, student_reg_no, student_name, department, year, section, start_date, end_date,
            days_count, reason, type, status, applied_on, reviewed_by, reviewed_on, reviewer_comments
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status=VALUES(status), reviewed_by=VALUES(reviewed_by),
            reviewed_on=VALUES(reviewed_on), reviewer_comments=VALUES(reviewer_comments);`,
          [
            req.id,
            req.studentRegNo,
            req.studentName,
            req.department,
            req.year,
            req.section,
            req.startDate,
            req.endDate,
            req.daysCount,
            req.reason,
            req.type,
            req.status,
            req.appliedOn,
            req.reviewedBy || null,
            req.reviewedOn || null,
            req.reviewerComments || null,
          ]
        );
        console.log(`[Repository] Persisted leave request ${req.id} to TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to persist leave request to TiDB Cloud:`, err.message);
      }
    }
  }

  // Persist Announcement
  public async persistAnnouncement(ann: Announcement): Promise<void> {
    const idx = this.announcements.findIndex((a) => a.id === ann.id);
    if (idx >= 0) {
      this.announcements[idx] = ann;
    } else {
      this.announcements.unshift(ann);
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO announcements (id, title, content, author, author_role, target_audience, priority, date, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content), priority=VALUES(priority);`,
          [ann.id, ann.title, ann.content, ann.author, ann.authorRole, ann.targetAudience, ann.priority, ann.date, ann.category]
        );
        console.log(`[Repository] Persisted announcement ${ann.id} to TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to persist announcement to TiDB Cloud:`, err.message);
      }
    }
  }

  // Remove Announcement
  public async removeAnnouncement(id: string): Promise<boolean> {
    const idx = this.announcements.findIndex((a) => a.id === id);
    if (idx >= 0) {
      this.announcements.splice(idx, 1);
    }
    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
        console.log(`[Repository] Deleted announcement ${id} from TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to delete announcement from TiDB Cloud:`, err.message);
      }
    }
    return true;
  }

  // Persist Fee Record
  public async persistFee(fee: FeeRecord): Promise<void> {
    const idx = this.fees.findIndex((f) => f.id === fee.id);
    if (idx >= 0) {
      this.fees[idx] = fee;
    } else {
      this.fees.push(fee);
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO fees (
            id, student_reg_no, student_name, academic_year, semester, tuition_fee, development_fee,
            exam_fee, total_fee, paid_amount, due_amount, status, no_due_approved, last_payment_date, receipt_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            paid_amount=VALUES(paid_amount), due_amount=VALUES(due_amount), status=VALUES(status),
            no_due_approved=VALUES(no_due_approved), last_payment_date=VALUES(last_payment_date),
            receipt_number=VALUES(receipt_number);`,
          [
            fee.id,
            fee.studentRegNo,
            fee.studentName,
            fee.academicYear,
            fee.semester,
            fee.tuitionFee,
            fee.developmentFee,
            fee.examFee,
            fee.totalFee,
            fee.paidAmount,
            fee.dueAmount,
            fee.status,
            fee.noDueApproved ? 1 : 0,
            fee.lastPaymentDate || null,
            fee.receiptNumber || null,
          ]
        );
        console.log(`[Repository] Persisted fee record ${fee.id} to TiDB Cloud.`);
      } catch (err: any) {
        console.error('[Repository] Failed to persist fee to TiDB Cloud:', err.message);
      }
    }
  }

  // Persist user account changes
  public async persistUser(user: UserAccount) {
    const existingIdx = this.users.findIndex((u) => u.id.toLowerCase() === user.id.toLowerCase());
    if (existingIdx >= 0) {
      this.users[existingIdx] = user;
    } else {
      this.users.push(user);
    }

    const pool = getMySqlPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO users (id, email, password_hash, role, name, status, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             email=VALUES(email),
             password_hash=VALUES(password_hash),
             role=VALUES(role),
             name=VALUES(name),
             status=VALUES(status),
             last_login=VALUES(last_login);`,
          [
            user.id,
            user.email,
            user.passwordHash,
            user.role,
            user.name,
            user.status || 'Active',
            user.lastLogin || null,
          ]
        );
        console.log(`[Repository] Persisted user ${user.id} to TiDB Cloud.`);
      } catch (err: any) {
        console.error(`[Repository] Failed to persist user ${user.id} to TiDB:`, err.message);
      }
    }
  }

  // Add structured audit log
  public logAudit(action: string, performedBy: string, role: string, details: string, ip = '127.0.0.1') {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      performedBy,
      userRole: role,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: ip,
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }

    const pool = getMySqlPool();
    if (pool) {
      pool
        .query(
          `INSERT INTO audit_logs (id, action, performed_by, user_role, details, timestamp, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [log.id, log.action, log.performedBy, log.userRole, log.details, log.timestamp, log.ipAddress]
        )
        .catch((e: any) => console.error('[Repository] Failed to persist audit log:', e.message));
    }

    return log;
  }

  // Recalculate student attendance percentage from attendance records
  public recalculateStudentAttendance(regNo: string) {
    const student = this.students.find((s) => s.regNo.toUpperCase() === regNo.toUpperCase());
    if (!student) return;

    const studentLogs = this.attendance.filter((a) => a.regNo.toUpperCase() === regNo.toUpperCase());
    if (studentLogs.length === 0) return;

    let present = 0;
    let absent = 0;
    let od = 0;

    studentLogs.forEach((rec) => {
      if (rec.status === 'Present') present++;
      else if (rec.status === 'Absent') absent++;
      else if (rec.status === 'OD') od++;
    });

    const total = studentLogs.length;
    const effectiveAttended = present + od;
    const percentage = total > 0 ? Math.round((effectiveAttended / total) * 1000) / 10 : 0;

    student.overallAttendance = {
      present,
      absent,
      od,
      total,
      percentage,
    };
  }

  // Sync entire local repository state into TiDB Cloud
  public async syncAllToDb(): Promise<{ success: boolean; message: string }> {
    const pool = getMySqlPool();
    if (!pool) {
      return { success: false, message: 'TiDB Cloud connection pool is not available. Please verify credentials.' };
    }

    try {
      console.log('[Repository] Starting full sync of current state into TiDB Cloud...');
      for (const student of this.students) {
        await this.persistStudent(student);
      }
      for (const f of this.faculty) {
        await this.persistFaculty(f);
      }
      await this.persistHOD(this.hod);
      for (const ann of this.announcements) {
        await this.persistAnnouncement(ann);
      }
      for (const l of this.leaveRequests) {
        await this.persistLeaveRequest(l);
      }
      for (const fee of this.fees) {
        await this.persistFee(fee);
      }
      for (const att of this.attendance) {
        await pool.query(
          `INSERT INTO attendance_records (id, date, reg_no, student_name, subject_code, subject_name, section, year, status, marked_by, period)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status);`,
          [att.id, att.date, att.regNo, att.studentName, att.subjectCode, att.subjectName, att.section, att.year, att.status, att.markedBy, att.period || 1]
        );
      }
      return {
        success: true,
        message: `Successfully synced ${this.students.length} students, ${this.faculty.length} faculty, and all records to TiDB Cloud!`,
      };
    } catch (err: any) {
      return { success: false, message: `Sync failed: ${err.message}` };
    }
  }
}

export const repo = new InstitutionalRepository();
