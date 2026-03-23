import { PersonaOrchestrationModel } from '../models/PersonaOrchestration';
import { PersonaInvocationModel } from '../models/PersonaInvocation';
import { RequirementModel } from '../models/Requirement';
import { RefinementSessionModel } from '../models/RefinementSession';
import {
  PersonaOrchestrationRule,
  PersonaRuleCondition,
  PersonaRuleAction,
  PersonaOrchestrationExecution,
  PersonaExecutedAction,
  TriggerOrchestrationRequest
} from '../models/types';

/**
 * Service for executing persona orchestration rules
 * Handles condition evaluation and action execution for default persona progression
 */
export class PersonaOrchestrationService {
  /**
   * Trigger orchestration evaluation for an event
   */
  static async triggerOrchestration(data: TriggerOrchestrationRequest): Promise<{
    triggered_executions: PersonaOrchestrationExecution[];
    actions_executed: number;
  }> {
    console.log(`[ORCHESTRATION] Triggering orchestration for event: ${data.trigger_event}`);

    const triggeredExecutions: PersonaOrchestrationExecution[] = [];
    let totalActionsExecuted = 0;

    try {
      // Get all active rules that might apply to this event
      const activeRules = await PersonaOrchestrationModel.findActiveRules();

      for (const rule of activeRules) {
        try {
          // Check if this rule's conditions are met
          const conditionsMet = await this.evaluateRuleConditions(rule, data);

          if (conditionsMet) {
            console.log(`[ORCHESTRATION] Rule "${rule.rule_name}" conditions met, executing actions`);

            // Log the execution
            const execution = await PersonaOrchestrationModel.logExecution({
              rule_id: rule.id,
              requirement_id: data.requirement_id,
              session_id: data.session_id,
              trigger_event: data.trigger_event,
              trigger_data: data.trigger_data
            });

            triggeredExecutions.push(execution);

            // Update execution status to executing
            await PersonaOrchestrationModel.updateExecutionStatus(execution.id, 'executing');

            // Execute the rule's actions
            const executedActions = await this.executeRuleActions(rule, data, execution.id);
            totalActionsExecuted += executedActions.length;

            // Update execution status to completed
            await PersonaOrchestrationModel.updateExecutionStatus(
              execution.id,
              'completed',
              executedActions
            );

            console.log(`[ORCHESTRATION] Rule "${rule.rule_name}" executed successfully with ${executedActions.length} actions`);
          }
        } catch (error) {
          console.error(`[ORCHESTRATION] Error executing rule "${rule.rule_name}":`, error);

          // Update execution status to failed if we have an execution logged
          const execution = triggeredExecutions.find(e => e.rule_id === rule.id);
          if (execution) {
            await PersonaOrchestrationModel.updateExecutionStatus(
              execution.id,
              'failed',
              [],
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
      }

      console.log(`[ORCHESTRATION] Orchestration complete: ${triggeredExecutions.length} rules triggered, ${totalActionsExecuted} actions executed`);

      return {
        triggered_executions: triggeredExecutions,
        actions_executed: totalActionsExecuted
      };
    } catch (error) {
      console.error('[ORCHESTRATION] Error during orchestration trigger:', error);
      throw error;
    }
  }

  /**
   * Evaluate if a rule's conditions are met
   */
  private static async evaluateRuleConditions(
    rule: PersonaOrchestrationRule,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    try {
      const conditions = rule.conditions as PersonaRuleCondition[];

      // All conditions must be met (AND logic)
      for (const condition of conditions) {
        const conditionMet = await this.evaluateCondition(condition, context);
        if (!conditionMet) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`[ORCHESTRATION] Error evaluating conditions for rule "${rule.rule_name}":`, error);
      return false;
    }
  }

  /**
   * Evaluate a single condition
   */
  private static async evaluateCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    try {
      switch (condition.condition_type) {
        case 'requirement_status':
          return this.evaluateRequirementStatusCondition(condition, context);

        case 'persona_invoked':
          return this.evaluatePersonaInvokedCondition(condition, context);

        case 'session_status':
          return this.evaluateSessionStatusCondition(condition, context);

        case 'user_action':
          return this.evaluateUserActionCondition(condition, context);

        case 'dimension_contributed':
          return this.evaluateDimensionContributedCondition(condition, context);

        case 'time_elapsed':
          return this.evaluateTimeElapsedCondition(condition, context);

        default:
          console.warn(`[ORCHESTRATION] Unknown condition type: ${condition.condition_type}`);
          return false;
      }
    } catch (error) {
      console.error(`[ORCHESTRATION] Error evaluating condition ${condition.condition_type}:`, error);
      return false;
    }
  }

  /**
   * Evaluate requirement status condition
   */
  private static async evaluateRequirementStatusCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    if (!context.requirement_id) return false;

    try {
      const requirement = await RequirementModel.findById(context.requirement_id);
      if (!requirement) return false;

      // Check if this is a requirement creation event
      const isCreationEvent = condition.condition_data?.event === 'requirement_created' &&
                              context.trigger_event === 'requirement_created';

      if (isCreationEvent) {
        return this.compareValues(requirement.status, condition.operator, condition.expected_value);
      }

      // Check minimum personas invoked if specified
      if (condition.condition_data?.min_personas_invoked) {
        const invocations = await PersonaInvocationModel.findByRequirementId(context.requirement_id);
        const completedInvocations = invocations.filter(i => i.invocation_status === 'completed');

        if (completedInvocations.length < condition.condition_data.min_personas_invoked) {
          return false;
        }
      }

      return this.compareValues(requirement.status, condition.operator, condition.expected_value);
    } catch (error) {
      console.error('[ORCHESTRATION] Error evaluating requirement status condition:', error);
      return false;
    }
  }

  /**
   * Evaluate persona invoked condition
   */
  private static async evaluatePersonaInvokedCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    if (!context.requirement_id && !context.session_id) return false;

    try {
      let invocations;

      if (context.requirement_id) {
        invocations = await PersonaInvocationModel.findByRequirementId(context.requirement_id);
      } else if (context.session_id) {
        invocations = await PersonaInvocationModel.findBySessionId(context.session_id);
      } else {
        return false;
      }

      // Check if the specified persona type was invoked
      const targetPersonaType = condition.expected_value;
      const targetInvocations = invocations.filter(inv => inv.persona_type === targetPersonaType);

      if (targetInvocations.length === 0) return false;

      // Check status if specified
      if (condition.condition_data?.status) {
        const statusMatches = targetInvocations.some(inv =>
          inv.invocation_status === condition.condition_data.status
        );
        return statusMatches;
      }

      return true;
    } catch (error) {
      console.error('[ORCHESTRATION] Error evaluating persona invoked condition:', error);
      return false;
    }
  }

  /**
   * Evaluate session status condition
   */
  private static async evaluateSessionStatusCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    if (!context.session_id) return false;

    try {
      const session = await RefinementSessionModel.findById(context.session_id);
      if (!session) return false;

      return this.compareValues(session.status, condition.operator, condition.expected_value);
    } catch (error) {
      console.error('[ORCHESTRATION] Error evaluating session status condition:', error);
      return false;
    }
  }

  /**
   * Evaluate user action condition
   */
  private static evaluateUserActionCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): boolean {
    return this.compareValues(context.trigger_event, condition.operator, condition.expected_value);
  }

  /**
   * Evaluate dimension contributed condition
   */
  private static async evaluateDimensionContributedCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    if (!context.requirement_id) return false;

    try {
      const invocations = await PersonaInvocationModel.findByRequirementId(context.requirement_id);

      // Check if any invocation has contributed dimensions matching the condition
      for (const invocation of invocations) {
        if (invocation.contributed_dimensions && Array.isArray(invocation.contributed_dimensions)) {
          for (const dimension of invocation.contributed_dimensions) {
            if (condition.condition_data?.dimension_category &&
                dimension.category === condition.condition_data.dimension_category) {

              const dimensionValue = dimension.value || dimension.name || '';
              if (this.compareValues(dimensionValue, condition.operator, condition.expected_value)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[ORCHESTRATION] Error evaluating dimension contributed condition:', error);
      return false;
    }
  }

  /**
   * Evaluate time elapsed condition
   */
  private static async evaluateTimeElapsedCondition(
    condition: PersonaRuleCondition,
    context: TriggerOrchestrationRequest
  ): Promise<boolean> {
    // Time elapsed conditions would need specific implementation
    // based on what we're measuring elapsed time from
    console.warn('[ORCHESTRATION] Time elapsed condition evaluation not implemented');
    return false;
  }

  /**
   * Execute actions for a rule
   */
  private static async executeRuleActions(
    rule: PersonaOrchestrationRule,
    context: TriggerOrchestrationRequest,
    execution_id: string
  ): Promise<PersonaExecutedAction[]> {
    const actions = rule.actions as PersonaRuleAction[];
    const executedActions: PersonaExecutedAction[] = [];

    for (const action of actions) {
      try {
        // Apply delay if specified
        if (action.delay_seconds && action.delay_seconds > 0) {
          console.log(`[ORCHESTRATION] Delaying action ${action.action_type} for ${action.delay_seconds} seconds`);
          await new Promise(resolve => setTimeout(resolve, action.delay_seconds! * 1000));
        }

        const executedAction = await this.executeAction(action, context);
        executedActions.push(executedAction);

        console.log(`[ORCHESTRATION] Action ${action.action_type} executed successfully`);
      } catch (error) {
        console.error(`[ORCHESTRATION] Error executing action ${action.action_type}:`, error);

        executedActions.push({
          action_type: action.action_type,
          action_data: action.action_data,
          execution_status: 'failed',
          executed_at: new Date(),
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return executedActions;
  }

  /**
   * Execute a single action
   */
  private static async executeAction(
    action: PersonaRuleAction,
    context: TriggerOrchestrationRequest
  ): Promise<PersonaExecutedAction> {
    switch (action.action_type) {
      case 'invoke_persona':
        return this.executeInvokePersonaAction(action, context);

      case 'update_session':
        return this.executeUpdateSessionAction(action, context);

      case 'send_notification':
        return this.executeSendNotificationAction(action, context);

      case 'update_requirement':
        return this.executeUpdateRequirementAction(action, context);

      case 'create_task':
        return this.executeCreateTaskAction(action, context);

      default:
        throw new Error(`Unknown action type: ${action.action_type}`);
    }
  }

  /**
   * Execute invoke persona action
   */
  private static async executeInvokePersonaAction(
    action: PersonaRuleAction,
    context: TriggerOrchestrationRequest
  ): Promise<PersonaExecutedAction> {
    if (!context.requirement_id || !context.session_id) {
      throw new Error('Requirement ID and Session ID are required for persona invocation');
    }

    // Use a system user ID if no user context is provided
    const userId = context.trigger_data?.user_id || 'system';

    const personaData = action.action_data;

    const invocation = await PersonaInvocationModel.create({
      requirement_id: context.requirement_id,
      session_id: context.session_id,
      persona_name: personaData.persona_name,
      persona_type: personaData.persona_type,
      persona_description: personaData.persona_description,
      invocation_reason: personaData.invocation_reason,
      trigger_context: {
        auto_invoked: personaData.auto_invoked || true,
        orchestration_trigger: context.trigger_event,
        ...personaData.trigger_context
      },
      contributed_dimensions: [],
      invocation_metadata: {
        orchestrated: true,
        ...personaData.invocation_metadata
      }
    }, userId);

    return {
      action_type: action.action_type,
      action_data: action.action_data,
      execution_status: 'completed',
      executed_at: new Date(),
      result_data: { invocation_id: invocation.id }
    };
  }

  /**
   * Execute update session action
   */
  private static async executeUpdateSessionAction(
    action: PersonaRuleAction,
    context: TriggerOrchestrationRequest
  ): Promise<PersonaExecutedAction> {
    if (!context.session_id) {
      throw new Error('Session ID is required for session update');
    }

    const updateData = action.action_data;
    await RefinementSessionModel.update(context.session_id, updateData);

    return {
      action_type: action.action_type,
      action_data: action.action_data,
      execution_status: 'completed',
      executed_at: new Date(),
      result_data: { session_id: context.session_id }
    };
  }

  /**
   * Execute send notification action
   */
  private static async executeSendNotificationAction(
    action: PersonaRuleAction,
    context: TriggerOrchestrationRequest
  ): Promise<PersonaExecutedAction> {
    // Notification implementation would go here
    console.log(`[ORCHESTRATION] Notification sent:`, action.action_data.message);

    return {
      action_type: action.action_type,
      action_data: action.action_data,
      execution_status: 'completed',
      executed_at: new Date(),
      result_data: { notification_sent: true }
    };
  }

  /**
   * Execute update requirement action
   */
  private static async executeUpdateRequirementAction(
    action: PersonaRuleAction,
    context: TriggerOrchestrationRequest
  ): Promise<PersonaExecutedAction> {
    if (!context.requirement_id) {
      throw new Error('Requirement ID is required for requirement update');
    }

    const updateData = action.action_data;
    await RequirementModel.update(context.requirement_id, updateData);

    return {
      action_type: action.action_type,
      action_data: action.action_data,
      execution_status: 'completed',
      executed_at: new Date(),
      result_data: { requirement_id: context.requirement_id }
    };
  }

  /**
   * Execute create task action
   */
  private static async executeCreateTaskAction(
    action: PersonaRuleAction,
    context: TriggerOrchestrationRequest
  ): Promise<PersonaExecutedAction> {
    // Task creation implementation would go here
    console.log(`[ORCHESTRATION] Task created:`, action.action_data.task_title);

    return {
      action_type: action.action_type,
      action_data: action.action_data,
      execution_status: 'completed',
      executed_at: new Date(),
      result_data: { task_created: true }
    };
  }

  /**
   * Compare values using the specified operator
   */
  private static compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'contains':
        return typeof actual === 'string' && actual.toLowerCase().includes(expected.toLowerCase());
      case 'not_contains':
        return typeof actual === 'string' && !actual.toLowerCase().includes(expected.toLowerCase());
      case 'exists':
        return actual !== null && actual !== undefined;
      case 'not_exists':
        return actual === null || actual === undefined;
      default:
        console.warn(`[ORCHESTRATION] Unknown operator: ${operator}`);
        return false;
    }
  }
}