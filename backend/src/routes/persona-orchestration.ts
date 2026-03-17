import { Router, Request, Response } from 'express';
import { PersonaOrchestrationModel } from '../models/PersonaOrchestration';
import { PersonaOrchestrationService } from '../services/persona-orchestration-service';
import {
  CreateOrchestrationRuleRequest,
  UpdateOrchestrationRuleRequest,
  CreateProgressionConfigRequest,
  TriggerOrchestrationRequest,
  User
} from '../models/types';
import { requireAuth } from '../config/auth';
import { validateAccess } from '../middleware/validateAccess';

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * Orchestration Rules Management
 */

// Create a new orchestration rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const data = req.body as CreateOrchestrationRuleRequest;

    // Validate required fields
    if (!data.rule_name || !data.rule_type || !data.conditions || !data.actions) {
      return res.status(400).json({
        error: 'Missing required fields: rule_name, rule_type, conditions, actions'
      });
    }

    const rule = await PersonaOrchestrationModel.createRule(data);

    console.log(`[ORCHESTRATION] Rule created: ${rule.rule_name} by user ${user.id}`);
    res.status(201).json(rule);
  } catch (error) {
    console.error('[ORCHESTRATION] Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create orchestration rule' });
  }
});

// Get all active orchestration rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const rule_type = req.query.rule_type as string;
    const rules = await PersonaOrchestrationModel.findActiveRules(rule_type);

    res.json(rules);
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch orchestration rules' });
  }
});

// Get orchestration rule by ID
router.get('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await PersonaOrchestrationModel.findRuleById(id);

    if (!rule) {
      return res.status(404).json({ error: 'Orchestration rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching rule:', error);
    res.status(500).json({ error: 'Failed to fetch orchestration rule' });
  }
});

// Update orchestration rule
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateOrchestrationRuleRequest;

    const rule = await PersonaOrchestrationModel.updateRule(id, data);

    if (!rule) {
      return res.status(404).json({ error: 'Orchestration rule not found' });
    }

    console.log(`[ORCHESTRATION] Rule updated: ${rule.rule_name} by user ${(req.user as User)?.id}`);
    res.json(rule);
  } catch (error) {
    console.error('[ORCHESTRATION] Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update orchestration rule' });
  }
});

// Delete orchestration rule
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First get the rule to log its name
    const rule = await PersonaOrchestrationModel.findRuleById(id);
    if (!rule) {
      return res.status(404).json({ error: 'Orchestration rule not found' });
    }

    const deleted = await PersonaOrchestrationModel.deleteRule(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Orchestration rule not found' });
    }

    console.log(`[ORCHESTRATION] Rule deleted: ${rule.rule_name} by user ${(req.user as User)?.id}`);
    res.status(204).send();
  } catch (error) {
    console.error('[ORCHESTRATION] Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete orchestration rule' });
  }
});

/**
 * Progression Configuration Management
 */

// Create progression configuration
router.post('/progressions', async (req: Request, res: Response) => {
  try {
    const data = req.body as CreateProgressionConfigRequest;

    if (!data.progression_name || !data.default_sequence || data.default_sequence.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: progression_name, default_sequence'
      });
    }

    const progression = await PersonaOrchestrationModel.createProgression(data);

    console.log(`[ORCHESTRATION] Progression created: ${progression.progression_name} by user ${(req.user as User)?.id}`);
    res.status(201).json(progression);
  } catch (error) {
    console.error('[ORCHESTRATION] Error creating progression:', error);
    res.status(500).json({ error: 'Failed to create progression configuration' });
  }
});

// Get all progression configurations
router.get('/progressions', async (req: Request, res: Response) => {
  try {
    const progressions = await PersonaOrchestrationModel.findAllProgressions();
    res.json(progressions);
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching progressions:', error);
    res.status(500).json({ error: 'Failed to fetch progression configurations' });
  }
});

// Get default progression configuration
router.get('/progressions/default', async (req: Request, res: Response) => {
  try {
    const progression = await PersonaOrchestrationModel.findDefaultProgression();

    if (!progression) {
      return res.status(404).json({ error: 'No default progression configuration found' });
    }

    res.json(progression);
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching default progression:', error);
    res.status(500).json({ error: 'Failed to fetch default progression configuration' });
  }
});

// Get progression configuration by ID
router.get('/progressions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const progression = await PersonaOrchestrationModel.findProgressionById(id);

    if (!progression) {
      return res.status(404).json({ error: 'Progression configuration not found' });
    }

    res.json(progression);
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching progression:', error);
    res.status(500).json({ error: 'Failed to fetch progression configuration' });
  }
});

/**
 * Orchestration Execution
 */

// Trigger orchestration manually
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const data = req.body as TriggerOrchestrationRequest;

    if (!data.trigger_event) {
      return res.status(400).json({ error: 'Missing required field: trigger_event' });
    }

    console.log(`[ORCHESTRATION] Manual trigger requested by user ${(req.user as User)?.id}: ${data.trigger_event}`);

    const result = await PersonaOrchestrationService.triggerOrchestration(data);

    res.json({
      message: 'Orchestration triggered successfully',
      ...result
    });
  } catch (error) {
    console.error('[ORCHESTRATION] Error triggering orchestration:', error);
    res.status(500).json({ error: 'Failed to trigger orchestration' });
  }
});

// Get execution history for a requirement
router.get('/executions/requirement/:requirement_id',
  validateAccess('requirement'),
  async (req: Request, res: Response) => {
    try {
      const { requirement_id } = req.params;
      const executions = await PersonaOrchestrationModel.findExecutionsByRequirement(requirement_id);

      res.json(executions);
    } catch (error) {
      console.error('[ORCHESTRATION] Error fetching requirement executions:', error);
      res.status(500).json({ error: 'Failed to fetch execution history' });
    }
  }
);

// Get execution history for a session
router.get('/executions/session/:session_id',
  validateAccess('session'),
  async (req: Request, res: Response) => {
    try {
      const { session_id } = req.params;
      const executions = await PersonaOrchestrationModel.findExecutionsBySession(session_id);

      res.json(executions);
    } catch (error) {
      console.error('[ORCHESTRATION] Error fetching session executions:', error);
      res.status(500).json({ error: 'Failed to fetch execution history' });
    }
  }
);

// Get recent executions with details
router.get('/executions/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const executions = await PersonaOrchestrationModel.findRecentExecutions(limit);

    res.json(executions);
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching recent executions:', error);
    res.status(500).json({ error: 'Failed to fetch recent executions' });
  }
});

/**
 * Analytics and Statistics
 */

// Get orchestration statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await PersonaOrchestrationModel.getOrchestrationStats();

    res.json({
      generated_at: new Date().toISOString(),
      ...stats
    });
  } catch (error) {
    console.error('[ORCHESTRATION] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch orchestration statistics' });
  }
});

/**
 * Testing and Development Endpoints
 */

// Test rule conditions (for development/testing)
router.post('/test/rule/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const context = req.body as TriggerOrchestrationRequest;

    const rule = await PersonaOrchestrationModel.findRuleById(id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Test conditions without executing actions
    const conditionsMet = await (PersonaOrchestrationService as any).evaluateRuleConditions(rule, context);

    res.json({
      rule_id: id,
      rule_name: rule.rule_name,
      conditions_met: conditionsMet,
      test_context: context
    });
  } catch (error) {
    console.error('[ORCHESTRATION] Error testing rule:', error);
    res.status(500).json({ error: 'Failed to test rule conditions' });
  }
});

export default router;