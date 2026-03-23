import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { TicketModel } from '../models/Ticket';
import { ProjectModel } from '../models/Project';
import { CreateTicketRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All ticket routes require authentication
router.use(requireAuth);

// Get user's tickets (across all projects they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const tickets = await TicketModel.findByUserId(user.id);

    res.json({
      tickets,
      total: tickets.length
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch tickets'
    });
  }
});

// Get tickets in a specific project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const tickets = await TicketModel.findByProjectId(projectId);

    res.json({
      tickets,
      total: tickets.length
    });
  } catch (error) {
    console.error('Error fetching project tickets:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project tickets'
    });
  }
});

// Get tickets authored by the user
router.get('/authored', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const tickets = await TicketModel.findByAuthorId(user.id);

    res.json({
      tickets,
      total: tickets.length
    });
  } catch (error) {
    console.error('Error fetching authored tickets:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch authored tickets'
    });
  }
});

// Get tickets assigned to the user
router.get('/assigned', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const tickets = await TicketModel.findByAssigneeId(user.id);

    res.json({
      tickets,
      total: tickets.length
    });
  } catch (error) {
    console.error('Error fetching assigned tickets:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch assigned tickets'
    });
  }
});

// Get a specific ticket by ID with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this ticket
    const hasAccess = await TicketModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket'
      });
    }

    const ticket = await TicketModel.findByIdWithDetails(id);
    if (!ticket) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket'
    });
  }
});

// Create a new ticket
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateTicketRequest = req.body;

    // Validate required fields
    if (!data.title || !data.project_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title and project_id are required'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Create the ticket
    const ticket = await TicketModel.create(data, user.id);

    // Return the ticket with full details
    const ticketWithDetails = await TicketModel.findByIdWithDetails(ticket.id);

    res.status(201).json(ticketWithDetails);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create ticket'
    });
  }
});

// Update a ticket
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data = req.body;

    // Check if user can access this ticket
    const hasAccess = await TicketModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket'
      });
    }

    // Update the ticket
    const ticket = await TicketModel.update(id, data);
    if (!ticket) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    // Return the ticket with full details
    const ticketWithDetails = await TicketModel.findByIdWithDetails(ticket.id);

    res.json(ticketWithDetails);
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update ticket'
    });
  }
});

// Update ticket status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    const validStatuses = ['open', 'in_progress', 'completed', 'closed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Check if user can access this ticket
    const hasAccess = await TicketModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket'
      });
    }

    // Update the ticket status
    const ticket = await TicketModel.updateStatus(id, status);
    if (!ticket) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    // Return the ticket with full details
    const ticketWithDetails = await TicketModel.findByIdWithDetails(ticket.id);

    res.json(ticketWithDetails);
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update ticket status'
    });
  }
});

// Assign/unassign ticket
router.patch('/:id/assign', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { assignee_id } = req.body;

    // Check if user can access this ticket
    const hasAccess = await TicketModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this ticket'
      });
    }

    // Assign the ticket (null to unassign)
    const ticket = await TicketModel.assign(id, assignee_id || null);
    if (!ticket) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    // Return the ticket with full details
    const ticketWithDetails = await TicketModel.findByIdWithDetails(ticket.id);

    res.json(ticketWithDetails);
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to assign ticket'
    });
  }
});

// Delete a ticket (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user is the author of this ticket
    const isAuthor = await TicketModel.isUserAuthor(id, user.id);

    if (!isAuthor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only delete your own tickets'
      });
    }

    const deleted = await TicketModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete ticket'
    });
  }
});

export default router;