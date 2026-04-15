// controller/workerController.js
const pool = require('../config/db');

// Helper function to validate status transitions for worker
const isValidWorkerStatusTransition = (oldStatus, newStatus) => {
  const allowedTransitions = {
    'Assigned': ['In Progress'],
    'In Progress': ['Resolved'],
    'Escalated': ['In Progress']
  };
  
  return allowedTransitions[oldStatus]?.includes(newStatus) || false;
};

// Helper function to check if complaint is assigned to worker
const isAssignedToWorker = async (complaintId, workerId, client = null) => {
  const queryClient = client || pool;
  const result = await queryClient.query(
    'SELECT assigned_to, status FROM complaints WHERE complaint_id = $1',
    [complaintId]
  );
  
  if (result.rows.length === 0) {
    return { assigned: false, exists: false, complaint: null };
  }
  
  const complaint = result.rows[0];
  return {
    assigned: complaint.assigned_to === workerId,
    exists: true,
    complaint: complaint
  };
};

// A. GET ASSIGNED COMPLAINTS
const getAssignedComplaints = async (req, res) => {
  try {
    const workerId = req.user.user_id;
    const { status, priority, category, page = 1, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        c.complaint_id,
        c.title,
        c.description,
        c.category,
        c.priority,
        c.status,
        c.media_urls,
        c.remark,
        c.created_at,
        c.updated_at,
        u.name as user_name,
        u.email as user_email,
        u.phone_number as user_phone
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      WHERE c.assigned_to = $1
    `;
    
    const values = [workerId];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      values.push(status);
    }
    
    if (priority) {
      query += ` AND c.priority = $${paramIndex++}`;
      values.push(priority);
    }
    
    if (category) {
      query += ` AND c.category = $${paramIndex++}`;
      values.push(category);
    }
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM complaints 
      WHERE assigned_to = $1
    `;
    const countValues = [workerId];
    let countIndex = 2;
    
    if (status) {
      countQuery += ` AND status = $${countIndex++}`;
      countValues.push(status);
    }
    if (priority) {
      countQuery += ` AND priority = $${countIndex++}`;
      countValues.push(priority);
    }
    if (category) {
      countQuery += ` AND category = $${countIndex++}`;
      countValues.push(category);
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total);
    
    return res.status(200).json({
      success: true,
      message: 'Assigned complaints retrieved successfully',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching assigned complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching complaints',
      error: error.message
    });
  }
};

// B. GET SINGLE COMPLAINT DETAILS
const getComplaintById = async (req, res) => {
  try {
    const workerId = req.user.user_id;
    const { complaint_id } = req.params;
    
    if (!complaint_id || isNaN(complaint_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID'
      });
    }
    
    const query = `
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        w.name as worker_name,
        w.email as worker_email,
        w.department as worker_department
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN users w ON c.assigned_to = w.user_id
      WHERE c.complaint_id = $1
    `;
    
    const result = await pool.query(query, [complaint_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    const complaint = result.rows[0];
    
    // Security check: Verify worker is assigned to this complaint
    if (complaint.assigned_to !== workerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this complaint.'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Complaint details retrieved successfully',
      data: complaint
    });
    
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching complaint details',
      error: error.message
    });
  }
};

// C. UPDATE COMPLAINT STATUS
const updateComplaintStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const workerId = req.user.user_id;
    const { complaint_id } = req.params;
    const { new_status } = req.body;
    
    if (!complaint_id || !new_status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: complaint_id, new_status'
      });
    }
    
    // Validate status
    const validStatuses = ['Assigned', 'In Progress', 'Resolved', 'Escalated'];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Worker can only update to: ${validStatuses.join(', ')}`
      });
    }
    
    // Check if complaint exists and is assigned to worker
    const checkResult = await isAssignedToWorker(complaint_id, workerId, client);
    
    if (!checkResult.exists) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    if (!checkResult.assigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this complaint.'
      });
    }
    
    const old_status = checkResult.complaint.status;
    
    // Validate status transition
    if (!isValidWorkerStatusTransition(old_status, new_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${old_status}' to '${new_status}'. Allowed transitions: Assigned → In Progress, In Progress → Resolved, Escalated → In Progress`
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
      `INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [complaint_id, old_status, new_status, workerId]
    );
    
    // Insert into audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        workerId,
        'WORKER_STATUS_CHANGE',
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

// D. ADD REMARK TO COMPLAINT
const addRemark = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const workerId = req.user.user_id;
    const { complaint_id } = req.params;
    const { remark } = req.body;
    
    if (!complaint_id || !remark) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: complaint_id, remark'
      });
    }
    
    // Check if complaint exists and is assigned to worker
    const checkResult = await isAssignedToWorker(complaint_id, workerId, client);
    
    if (!checkResult.exists) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    if (!checkResult.assigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this complaint.'
      });
    }
    
    await client.query('BEGIN');
    
    // Get old remark before update
    const oldRemarkResult = await client.query(
      'SELECT remark FROM complaints WHERE complaint_id = $1',
      [complaint_id]
    );
    const old_remark = oldRemarkResult.rows[0].remark;
    
    // Update remark
    const updateResult = await client.query(
      `UPDATE complaints 
       SET remark = $1, updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING *`,
      [remark, complaint_id]
    );
    
    // Insert into audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        workerId,
        'ADD_REMARK',
        'complaints',
        complaint_id,
        JSON.stringify({ remark: old_remark }),
        JSON.stringify({ remark: remark })
      ]
    );
    
    await client.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: 'Remark added successfully',
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding remark:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding remark',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// E. VIEW STATUS HISTORY
const getStatusHistory = async (req, res) => {
  try {
    const workerId = req.user.user_id;
    const { complaint_id } = req.params;
    
    if (!complaint_id || isNaN(complaint_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID'
      });
    }
    
    // Verify worker is assigned to this complaint
    const checkResult = await isAssignedToWorker(complaint_id, workerId);
    
    if (!checkResult.exists) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    if (!checkResult.assigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this complaint.'
      });
    }
    
    // Get status history
    const historyQuery = `
      SELECT 
        sh.id,
        sh.complaint_id,
        sh.old_status,
        sh.new_status,
        sh.changed_at,
        u.name as changed_by_name,
        u.email as changed_by_email,
        u.role as changed_by_role
      FROM status_history sh
      LEFT JOIN users u ON sh.changed_by = u.user_id
      WHERE sh.complaint_id = $1
      ORDER BY sh.changed_at DESC
    `;
    
    const result = await pool.query(historyQuery, [complaint_id]);
    
    return res.status(200).json({
      success: true,
      message: 'Status history retrieved successfully',
      data: result.rows,
      count: result.rowCount
    });
    
  } catch (error) {
    console.error('Error fetching status history:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching status history',
      error: error.message
    });
  }
};

// F. VIEW OWN PROFILE
const getProfile = async (req, res) => {
  try {
    const workerId = req.user.user_id;
    
    const query = `
      SELECT 
        user_id,
        name,
        email,
        phone_number,
        role,
        department,
        created_at,
        updated_at
      FROM users 
      WHERE user_id = $1 AND role = 'worker'
    `;
    
    const result = await pool.query(query, [workerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }
    
    // Get statistics for the worker
    const statsQuery = `
      SELECT 
        COUNT(*) as total_assigned,
        COUNT(*) FILTER (WHERE status = 'Assigned') as pending_assignment,
        COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'Resolved') as resolved_count,
        COUNT(*) FILTER (WHERE status = 'Escalated') as escalated_count
      FROM complaints
      WHERE assigned_to = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [workerId]);
    
    return res.status(200).json({
      success: true,
      message: 'Worker profile retrieved successfully',
      data: {
        profile: result.rows[0],
        statistics: statsResult.rows[0]
      }
    });
    
  } catch (error) {
    console.error('Error fetching worker profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching profile',
      error: error.message
    });
  }
};

// G. GET DASHBOARD STATS
const getDashboardStats = async (req, res) => {
  try {
    const workerId = req.user.user_id;
    
    const query = `
      SELECT 
        COUNT(*) as total_assigned,
        COUNT(*) FILTER (WHERE status = 'Assigned') as pending_assignment,
        COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'Resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'Escalated') as escalated,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority,
        COUNT(*) FILTER (WHERE priority = 'low') as low_priority
      FROM complaints
      WHERE assigned_to = $1
    `;
    
    const result = await pool.query(query, [workerId]);
    
    // Get recent complaints
    const recentQuery = `
      SELECT 
        complaint_id,
        title,
        category,
        priority,
        status,
        created_at
      FROM complaints
      WHERE assigned_to = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    const recentResult = await pool.query(recentQuery, [workerId]);
    
    return res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        statistics: result.rows[0],
        recent_complaints: recentResult.rows
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAssignedComplaints,
  getComplaintById,
  updateComplaintStatus,
  addRemark,
  getStatusHistory,
  getProfile,
  getDashboardStats
};