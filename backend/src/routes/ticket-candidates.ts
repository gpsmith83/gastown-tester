import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { TicketCandidateModel } from '../models/TicketCandidate';
import { RequirementModel } from '../models/Requirement';
import { CreateTicketCandidateRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All ticket candidate routes require authentication
router.use(requireAuth);

// Get user's ticket candidates (across all requirements they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const ticketCandidates = await TicketCandidateModel.findByUserId(user.id);

    res.json({
      ticket_candidates: ticketCandidates,
      total: ticketCandidates.length
    });
  } catch (error) {
    console.error('Error fetching ticket candidates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket candidates'
    });
  }
});

// Get ticket candidates for a specific requirement
router.get('/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { requirementId } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const ticketCandidates = await TicketCandidateModel.findByRequirementId(requirementId);

    res.json({
      ticket_candidates: ticketCandidates,
      requirement_id: requirementId,
      total: ticketCandidates.length
    });
  } catch (error) {
    console.error('Error fetching requirement ticket candidates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement ticket candidates'
    });
  }
});

// Create new ticket candidate
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateTicketCandidateRequest = req.body;

    // Basic validation
    if (!data.title || data.title.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Ticket candidate title is required'
      });
    }

    if (!data.requirement_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Requirement ID is required'
      });
    }

    if (data.title.length > 500) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Ticket candidate title must be 500 characters or less'
      });
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate status
    if (data.status && !['draft', 'review', 'approved', 'rejected', 'archived'].includes(data.status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Status must be one of: draft, review, approved, rejected, archived'
      });
    }

    // Check if user has access to the requirement
    const hasAccess = await RequirementModel.canUserAccess(data.requirement_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // Clean up data
    const cleanData: CreateTicketCandidateRequest = {
      title: data.title.trim(),
      description: data.description?.trim(),
      requirement_id: data.requirement_id,
      priority: data.priority || 3,
      status: data.status || 'draft',
      order_index: data.order_index || 0,
      metadata: data.metadata,
      estimated_effort: data.estimated_effort?.trim(),
      labels: data.labels
    };

    const ticketCandidate = await TicketCandidateModel.create(cleanData, user.id);

    // Return ticket candidate with full details
    const ticketCandidateWithDetails = await TicketCandidateModel.findByIdWithDetails(ticketCandidate.id);

    res.status(201).json({
      ticket_candidate: ticketCandidateWithDetails,
      message: 'Ticket candidate created successfully'
    });
  } catch (error) {
    console.error('Error creating ticket candidate:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create ticket candidate'
    });
  }
});

// Get specific ticket candidate
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this ticket candidate
    const hasAccess = await TicketCandidateModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket candidate'
      });
    }

    const ticketCandidate = await TicketCandidateModel.findByIdWithDetails(id);
    if (!ticketCandidate) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket candidate not found'
      });
    }

    res.json({
      ticket_candidate: ticketCandidate
    });
  } catch (error) {
    console.error('Error fetching ticket candidate:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket candidate'
    });
  }
});

// Update ticket candidate
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreateTicketCandidateRequest> = req.body;

    // Check if user has access to this ticket candidate
    const hasAccess = await TicketCandidateModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket candidate'
      });
    }

    // Basic validation
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Ticket candidate title is required'
        });
      }

      if (data.title.length > 500) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Ticket candidate title must be 500 characters or less'
        });
      }

      data.title = data.title.trim();
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate status
    if (data.status && !['draft', 'review', 'approved', 'rejected', 'archived'].includes(data.status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Status must be one of: draft, review, approved, rejected, archived'
      });
    }

    // Clean up other fields
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    if (data.estimated_effort !== undefined) {
      data.estimated_effort = data.estimated_effort?.trim();
    }

    const ticketCandidate = await TicketCandidateModel.update(id, data);
    if (!ticketCandidate) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket candidate not found'
      });
    }

    // Return updated ticket candidate with full details
    const ticketCandidateWithDetails = await TicketCandidateModel.findByIdWithDetails(ticketCandidate.id);

    res.json({
      ticket_candidate: ticketCandidateWithDetails,
      message: 'Ticket candidate updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket candidate:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update ticket candidate'
    });
  }
});

// Update ticket candidate status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'review', 'approved', 'rejected', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be draft, review, approved, rejected, or archived'
      });
    }

    // Check if user has access to this ticket candidate
    const hasAccess = await TicketCandidateModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket candidate'
      });
    }

    const ticketCandidate = await TicketCandidateModel.updateStatus(id, status);
    if (!ticketCandidate) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket candidate not found'
      });
    }

    res.json({
      ticket_candidate: ticketCandidate,
      message: `Ticket candidate status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating ticket candidate status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update ticket candidate status'
    });
  }
});

// Update ticket candidate order
router.patch('/:id/order', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { order_index } = req.body;

    if (typeof order_index !== 'number' || order_index < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Order index must be a non-negative number'
      });
    }

    // Check if user has access to this ticket candidate
    const hasAccess = await TicketCandidateModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket candidate'
      });
    }

    const ticketCandidate = await TicketCandidateModel.updateOrderIndex(id, order_index);
    if (!ticketCandidate) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket candidate not found'
      });
    }

    res.json({
      ticket_candidate: ticketCandidate,
      message: 'Ticket candidate order updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket candidate order:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update ticket candidate order'
    });
  }
});

// Delete ticket candidate (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user is the author of this ticket candidate
    const isAuthor = await TicketCandidateModel.isUserAuthor(id, user.id);
    if (!isAuthor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only ticket candidate authors can delete ticket candidates'
      });
    }

    const deleted = await TicketCandidateModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket candidate not found'
      });
    }

    res.json({
      message: 'Ticket candidate deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticket candidate:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete ticket candidate'
    });
  }
});

export default router;