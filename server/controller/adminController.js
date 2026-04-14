const pool = require('../config/db');
const bcrypt = require('bcrypt');
require('dotenv').config();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { workerWelcome } = require('../utils/mailFormat'); // ✅ Import from mailFormat

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ❌ REMOVE this local workerWelcomeEmail function (lines 20-41)
// You don't need it anymore since you're importing from mailFormat

// Helper function to validate status transitions
const isValidStatusTransition = (oldStatus, newStatus) => {
  const allowedTransitions = {
    'Submitted': ['Assigned'],
    'Assigned': ['In Progress'],
    'In Progress': ['Resolved', 'Escalated'],
    'Resolved': ['Closed'],
    'Escalated': ['In Progress'],
    'Closed': [],
    'Resolved': ['Closed']
  };
  
  return allowedTransitions[oldStatus]?.includes(newStatus) || false;
};

// A. CREATE WORKER
const createWorker = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, email, phone_number, department } = req.body;
    
    // Input validation
    if (!name || !email || !phone_number || !department) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, phone_number, department'
      });
    }
    
    // Validate department
    const validDepartments = ['Network', 'Cleaning', 'Carpentry', 'PC Maintenance', 'Plumbing', 'Electricity'];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Invalid department. Must be one of: ${validDepartments.join(', ')}`
      });
    }
    
    // Check duplicate email
    const emailCheck = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    if (emailCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'A user already exists with this email.'
      });
    }
    
    // Check duplicate phone
    const phoneCheck = await client.query(
      'SELECT user_id FROM users WHERE phone_number = $1',
      [phone_number]
    );
    if (phoneCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'A user already exists with this phone number.'
      });
    }
    
    // Generate random password
    const plainPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    await client.query('BEGIN');
    
    // Insert worker into users table
    const userInsertQuery = `
      INSERT INTO users (name, email, password, phone_number, role, department)
      VALUES ($1, $2, $3, $4, 'worker', $5)
      RETURNING user_id, name, email, phone_number, role, department, created_at
    `;
    const userValues = [name, email, hashedPassword, phone_number, department];
    const userResult = await client.query(userInsertQuery, userValues);
    const newWorker = userResult.rows[0];
    
    // Log to audit_logs
    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await client.query(auditQuery, [
      req.user.user_id,
      'CREATE_WORKER',
      'users',
      newWorker.user_id,
      null,
      JSON.stringify({ name, email, phone_number, department })
    ]);
    
    await client.query('COMMIT');
    
    // Send email with credentials - ✅ Using imported workerWelcome
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Worker Account Credentials - College Complaint System',
        html: workerWelcome(email, plainPassword, name, department), // ✅ Changed from workerWelcomeEmail
      });
      
      return res.status(201).json({
        success: true,
        message: 'Worker created successfully and credentials emailed.',
        data: newWorker
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(201).json({
        success: true,
        message: 'Worker created but email failed to send. Please share credentials manually.',
        data: { ...newWorker, temporary_password: plainPassword }
      });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating worker:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating worker.',
      error: error.message
    });
  } finally {
    client.release();
  }
};


// B. GET ALL WORKERS
// Updated getWorkers function with performance metrics
const getWorkers = async (req, res) => {
  try {
    const { department } = req.query;
    
    let query = `
      SELECT 
        u.user_id, 
        u.name, 
        u.email, 
        u.phone_number, 
        u.department, 
        u.role, 
        u.created_at,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'Assigned') as assigned_count,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'In Progress') as in_progress_count,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'Resolved') as resolved_count,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'Closed') as closed_count,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'Escalated') as escalated_count,
        COUNT(c.complaint_id) as total_assigned
      FROM users u
      LEFT JOIN complaints c ON u.user_id = c.assigned_to
      WHERE u.role = 'worker'
    `;
    const values = [];
    
    if (department) {
      query += ` AND u.department = $1`;
      values.push(department);
    }
    
    query += ` GROUP BY u.user_id ORDER BY u.created_at DESC`;
    
    const result = await pool.query(query, values);
    
    // Calculate efficiency for each worker
    const workersWithMetrics = result.rows.map(worker => {
      const totalResolved = parseInt(worker.resolved_count) || 0;
      const totalAssigned = parseInt(worker.total_assigned) || 0;
      const efficiency = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 0;
      
      return {
        ...worker,
        assigned_count: parseInt(worker.assigned_count) || 0,
        in_progress_count: parseInt(worker.in_progress_count) || 0,
        resolved_count: totalResolved,
        closed_count: parseInt(worker.closed_count) || 0,
        escalated_count: parseInt(worker.escalated_count) || 0,
        total_assigned: totalAssigned,
        efficiency: efficiency,
        avg_resolution_time: null // Can be calculated with more complex query
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Workers retrieved successfully',
      data: workersWithMetrics,
      count: workersWithMetrics.length
    });
    
  } catch (error) {
    console.error('Error fetching workers:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching workers',
      error: error.message
    });
  }
};

// C. DELETE WORKER
const deleteWorker = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { user_id } = req.params;
    
    if (!user_id || isNaN(user_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing user ID'
      });
    }
    
    // Check if user exists and is a worker
    const workerCheck = await client.query(
      'SELECT user_id, name, email, role FROM users WHERE user_id = $1 AND role = $2',
      [user_id, 'worker']
    );
    
    if (workerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found with the given user ID'
      });
    }
    
    await client.query('BEGIN');
    
    // Log before deletion
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.user_id,
        'DELETE_WORKER',
        'users',
        user_id,
        JSON.stringify(workerCheck.rows[0]),
        null
      ]
    );
    
    // Delete worker (CASCADE will handle related records)
    await client.query('DELETE FROM users WHERE user_id = $1', [user_id]);
    
    await client.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: 'Worker deleted successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting worker:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting worker',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// D. GET ALL COMPLAINTS (with filters)
const getAllComplaints = async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        w.name as worker_name,
        w.department as worker_department
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN users w ON c.assigned_to = w.user_id
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      values.push(status);
    }
    
    if (category) {
      query += ` AND c.category = $${paramIndex++}`;
      values.push(category);
    }
    
    if (priority) {
      query += ` AND c.priority = $${paramIndex++}`;
      values.push(priority);
    }
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM complaints c WHERE 1=1`;
    const countValues = [];
    let countIndex = 1;
    
    if (status) {
      countQuery += ` AND c.status = $${countIndex++}`;
      countValues.push(status);
    }
    if (category) {
      countQuery += ` AND c.category = $${countIndex++}`;
      countValues.push(category);
    }
    if (priority) {
      countQuery += ` AND c.priority = $${countIndex++}`;
      countValues.push(priority);
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total);
    
    return res.status(200).json({
      success: true,
      message: 'Complaints retrieved successfully',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching complaints',
      error: error.message
    });
  }
};

// E. ASSIGN COMPLAINT
const assignComplaint = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { complaint_id, worker_id } = req.body;
    
    if (!complaint_id || !worker_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: complaint_id, worker_id'
      });
    }
    
    // Check if complaint exists and get its category
    const complaintCheck = await client.query(
      'SELECT complaint_id, category, status FROM complaints WHERE complaint_id = $1',
      [complaint_id]
    );
    
    if (complaintCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    const complaint = complaintCheck.rows[0];
    
    // Check if worker exists and get their department
    const workerCheck = await client.query(
      'SELECT user_id, name, department, role FROM users WHERE user_id = $1 AND role = $2',
      [worker_id, 'worker']
    );
    
    if (workerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }
    
    const worker = workerCheck.rows[0];
    
    // Check if worker department matches complaint category
    if (worker.department !== complaint.category) {
      return res.status(400).json({
        success: false,
        message: `Worker department (${worker.department}) does not match complaint category (${complaint.category})`
      });
    }
    
    // Check if complaint status allows assignment
    if (complaint.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: `Complaint cannot be assigned when status is '${complaint.status}'. Only 'Submitted' complaints can be assigned.`
      });
    }
    
    await client.query('BEGIN');
    
    // Update complaint
    const updateResult = await client.query(
      `UPDATE complaints 
       SET assigned_to = $1, status = 'Assigned', updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING *`,
      [worker_id, complaint_id]
    );
    
    // Insert into status_history
    await client.query(
      `INSERT INTO status_history (complaint_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [complaint_id, complaint.status, 'Assigned', req.user.user_id]
    );
    
    // Insert into audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.user_id,
        'ASSIGN_COMPLAINT',
        'complaints',
        complaint_id,
        JSON.stringify({ assigned_to: null, status: complaint.status }),
        JSON.stringify({ assigned_to: worker_id, status: 'Assigned', worker_name: worker.name })
      ]
    );
    
    await client.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: `Complaint assigned to ${worker.name} successfully`,
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while assigning complaint',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// F. REASSIGN COMPLAINT
const reassignComplaint = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { complaint_id, new_worker_id } = req.body;
    
    if (!complaint_id || !new_worker_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: complaint_id, new_worker_id'
      });
    }
    
    // Get current complaint details
    const complaintCheck = await client.query(
      'SELECT complaint_id, category, assigned_to, status FROM complaints WHERE complaint_id = $1',
      [complaint_id]
    );
    
    if (complaintCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    const complaint = complaintCheck.rows[0];
    
    if (!complaint.assigned_to) {
      return res.status(400).json({
        success: false,
        message: 'Complaint is not currently assigned to any worker'
      });
    }
    
    // Get old worker details
    const oldWorkerCheck = await client.query(
      'SELECT user_id, name, department FROM users WHERE user_id = $1',
      [complaint.assigned_to]
    );
    const oldWorker = oldWorkerCheck.rows[0];
    
    // Check new worker exists and department matches
    const newWorkerCheck = await client.query(
      'SELECT user_id, name, department FROM users WHERE user_id = $1 AND role = $2',
      [new_worker_id, 'worker']
    );
    
    if (newWorkerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'New worker not found'
      });
    }
    
    const newWorker = newWorkerCheck.rows[0];
    
    // Check department match
    if (newWorker.department !== complaint.category) {
      return res.status(400).json({
        success: false,
        message: `Worker department (${newWorker.department}) does not match complaint category (${complaint.category})`
      });
    }
    
    await client.query('BEGIN');
    
    // Update complaint with new worker
    const updateResult = await client.query(
      `UPDATE complaints 
       SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING *`,
      [new_worker_id, complaint_id]
    );
    
    // Insert into audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.user_id,
        'REASSIGN_COMPLAINT',
        'complaints',
        complaint_id,
        JSON.stringify({ assigned_to: complaint.assigned_to, worker_name: oldWorker?.name }),
        JSON.stringify({ assigned_to: new_worker_id, worker_name: newWorker.name })
      ]
    );
    
    await client.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: `Complaint reassigned from ${oldWorker?.name} to ${newWorker.name} successfully`,
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reassigning complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while reassigning complaint',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// G. UPDATE STATUS (ADMIN ACTION)
const updateComplaintStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { complaint_id, new_status } = req.body;
    
    if (!complaint_id || !new_status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: complaint_id, new_status'
      });
    }
    
    // Validate status
    const validStatuses = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Escalated'];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Get current complaint
    const complaintCheck = await client.query(
      'SELECT complaint_id, status, assigned_to FROM complaints WHERE complaint_id = $1',
      [complaint_id]
    );
    
    if (complaintCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    const complaint = complaintCheck.rows[0];
    const old_status = complaint.status;
    
    // Check if status transition is valid
    if (!isValidStatusTransition(old_status, new_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${old_status}' to '${new_status}'. Allowed transitions: Submitted → Assigned, Assigned → In Progress, In Progress → Resolved/Escalated, Resolved → Closed, Escalated → In Progress`
      });
    }
    
    // Additional validation: Can't close without being resolved
    if (new_status === 'Closed' && old_status !== 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Complaint must be Resolved before it can be Closed'
      });
    }
    
    await client.query('BEGIN');
    
    // Update complaint status
    const updateResult = await client.query(
      `UPDATE complaints 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING *`,
      [new_status, complaint_id]
    );
    
    // Insert into status_history
    await client.query(
      `INSERT INTO status_history (complaint_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [complaint_id, old_status, new_status, req.user.user_id]
    );
    
    // Insert into audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.user_id,
        'STATUS_CHANGE',
        'complaints',
        complaint_id,
        JSON.stringify({ status: old_status }),
        JSON.stringify({ status: new_status })
      ]
    );
    
    await client.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: `Complaint status updated from '${old_status}' to '${new_status}' successfully`,
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating complaint status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating complaint status',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// H. VIEW AUDIT LOGS
const getAuditLogs = async (req, res) => {
  try {
    const { user_id, action, date, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;
    
    if (user_id) {
      query += ` AND al.user_id = $${paramIndex++}`;
      values.push(user_id);
    }
    
    if (action) {
      query += ` AND al.action = $${paramIndex++}`;
      values.push(action);
    }
    
    if (date) {
      query += ` AND DATE(al.created_at) = $${paramIndex++}`;
      values.push(date);
    }
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1`;
    const countValues = [];
    let countIndex = 1;
    
    if (user_id) {
      countQuery += ` AND al.user_id = $${countIndex++}`;
      countValues.push(user_id);
    }
    if (action) {
      countQuery += ` AND al.action = $${countIndex++}`;
      countValues.push(action);
    }
    if (date) {
      countQuery += ` AND DATE(al.created_at) = $${countIndex++}`;
      countValues.push(date);
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total);
    
    return res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching audit logs',
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  createWorker,
  getWorkers,
  deleteWorker,
  getAllComplaints,
  assignComplaint,
  reassignComplaint,
  updateComplaintStatus,
  getAuditLogs
};