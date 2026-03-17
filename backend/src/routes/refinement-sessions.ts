import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { RefinementSessionModel } from '../models/RefinementSession';
import { RequirementMessageModel } from '../models/RequirementMessage';
import { RequirementModel } from '../models/Requirement';
import { RefinementSummaryModel } from '../models/RefinementSummary';
import { globalAIService } from '../services/ai-provider';
import { SummaryGeneratorService } from '../services/summary-generator';
import {
  StartRefinementRequest,
  StartRefinementResponse,
  CreateRefinementSessionRequest,
  User
} from '../models/types';

const router = Router();

// All refinement session routes require authentication
router.use(requireAuth);

// Start a new refinement session
router.post('/start', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: StartRefinementRequest = req.body;

    // Validation
    if (!data.requirement_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Requirement ID is required'
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

    // Get the requirement details for context
    const requirement = await RequirementModel.findByIdWithDetails(data.requirement_id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    // Create the refinement session
    const sessionData: CreateRefinementSessionRequest = {
      requirement_id: data.requirement_id,
      title: `Refinement for: ${requirement.title}`,
      description: `Refining requirement "${requirement.title}" in project ${requirement.project?.name || 'Unknown Project'}`
    };

    const session = await RefinementSessionModel.create(sessionData, user.id);
    const sessionWithDetails = await RefinementSessionModel.findByIdWithDetails(session.id);

    if (!sessionWithDetails) {
      throw new Error('Failed to retrieve created session details');
    }

    // Generate the first AI question to guide the refinement
    const systemPrompt = `You are an AI assistant helping to refine software requirements. Your role is to ask thoughtful questions that help clarify and improve the requirement specification.

The user has started a refinement session for this requirement:
- Title: ${requirement.title}
- Description: ${requirement.description || 'No description provided'}
- Type: ${requirement.type}
- Priority: ${requirement.priority} (1=highest, 5=lowest)
- Project: ${requirement.project?.name || 'Unknown'}

Your goal is to ask 1-2 focused questions that will help:
1. Clarify ambiguous aspects of the requirement
2. Identify missing details or edge cases
3. Better understand the user's intent and success criteria
4. Ensure the requirement is testable and implementable

${data.initial_context ? `Additional context provided by the user: ${data.initial_context}` : ''}

Ask your first question(s) to begin the refinement process. Keep it conversational and helpful.`;

    try {
      const aiResponse = await globalAIService.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Please help me refine this requirement. What should we discuss first?' }
        ],
        temperature: 0.7,
        maxTokens: 300
      }, {
        userId: user.id,
        projectId: requirement.project_id
      });

      // Create the first AI message in the session
      const firstMessage = await RequirementMessageModel.create({
        requirement_id: data.requirement_id,
        session_id: session.id,
        message_type: 'ai_response',
        content: aiResponse.content,
        role: 'assistant',
        metadata: {
          ai_provider: aiResponse.model || 'unknown',
          prompt_tokens: aiResponse.usage.promptTokens,
          completion_tokens: aiResponse.usage.completionTokens,
          total_tokens: aiResponse.usage.totalTokens,
          session_starter: true
        }
      });

      const response: StartRefinementResponse = {
        session: sessionWithDetails,
        first_question: firstMessage,
        message: 'Refinement session started successfully'
      };

      res.status(201).json(response);
    } catch (aiError) {
      console.error('Error generating first AI question:', aiError);

      // Fallback to a generic first message if AI fails
      const fallbackContent = `I'm here to help refine the requirement "${requirement.title}". Let's start by discussing what this feature should accomplish. Could you tell me more about the specific use case or problem this requirement is meant to solve?`;

      const firstMessage = await RequirementMessageModel.create({
        requirement_id: data.requirement_id,
        session_id: session.id,
        message_type: 'ai_response',
        content: fallbackContent,
        role: 'assistant',
        metadata: {
          fallback_message: true,
          session_starter: true,
          ai_error: aiError instanceof Error ? aiError.message : 'Unknown AI error'
        }
      });

      const response: StartRefinementResponse = {
        session: sessionWithDetails,
        first_question: firstMessage,
        message: 'Refinement session started successfully (using fallback question)'
      };

      res.status(201).json(response);
    }
  } catch (error) {
    console.error('Error starting refinement session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start refinement session'
    });
  }
});

// Get refinement session by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const session = await RefinementSessionModel.findByIdWithDetails(id);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    res.json({
      session
    });
  } catch (error) {
    console.error('Error fetching refinement session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement session'
    });
  }
});

// Get messages for a refinement session
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const messages = await RequirementMessageModel.findBySessionId(id);

    res.json({
      messages,
      total: messages.length
    });
  } catch (error) {
    console.error('Error fetching session messages:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch session messages'
    });
  }
});

// Add a new message to a refinement session and generate AI response
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id: sessionId } = req.params;
    const { content, message_type, metadata } = req.body;

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Message content is required'
      });
    }

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(sessionId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    // Get session with full details
    const sessionWithDetails = await RefinementSessionModel.findByIdWithDetails(sessionId);
    if (!sessionWithDetails) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    // Create the user message
    const userMessage = await RequirementMessageModel.create({
      requirement_id: sessionWithDetails.requirement_id,
      session_id: sessionId,
      message_type: message_type || 'user_message',
      content: content.trim(),
      role: 'user',
      metadata
    }, user.id);

    // Get conversation history for AI context
    const conversationHistory = await RequirementMessageModel.findBySessionId(sessionId);

    // Build AI conversation context
    const requirement = sessionWithDetails.requirement;
    const systemPrompt = `You are an AI assistant helping to refine software requirements. Your role is to ask thoughtful follow-up questions that help clarify and improve the requirement specification.

Current requirement being refined:
- Title: ${requirement.title}
- Description: ${requirement.description || 'No description provided'}
- Type: ${requirement.type}
- Priority: ${requirement.priority} (1=highest, 5=lowest)
- Project: ${requirement.project?.name || 'Unknown'}

Based on the conversation so far, continue asking focused questions that will help:
1. Clarify ambiguous aspects of the requirement
2. Identify missing details or edge cases
3. Better understand the user's intent and success criteria
4. Ensure the requirement is testable and implementable

Keep your questions conversational and helpful. Ask 1-2 focused questions per response.`;

    // Convert conversation history to AI format
    const aiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history excluding system messages
    for (const msg of conversationHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    try {
      // Generate AI response
      const aiResponse = await globalAIService.complete({
        messages: aiMessages,
        temperature: 0.7,
        maxTokens: 400
      }, {
        userId: user.id,
        projectId: requirement.project_id
      });

      // Create the AI response message
      const aiMessage = await RequirementMessageModel.create({
        requirement_id: sessionWithDetails.requirement_id,
        session_id: sessionId,
        message_type: 'ai_response',
        content: aiResponse.content,
        role: 'assistant',
        metadata: {
          ai_provider: aiResponse.model || 'unknown',
          prompt_tokens: aiResponse.usage.promptTokens,
          completion_tokens: aiResponse.usage.completionTokens,
          total_tokens: aiResponse.usage.totalTokens,
          response_to_message: userMessage.id
        }
      });

      const userMessageWithDetails = await RequirementMessageModel.findByIdWithDetails(userMessage.id);
      const aiMessageWithDetails = await RequirementMessageModel.findByIdWithDetails(aiMessage.id);

      // Generate summary snapshot if appropriate (B-204)
      try {
        const summaryId = await SummaryGeneratorService.generateSummaryForSession(sessionId, {
          userId: user.id,
          projectId: requirement.project_id
        });

        res.status(201).json({
          userMessage: userMessageWithDetails,
          aiResponse: aiMessageWithDetails,
          summaryGenerated: !!summaryId,
          summaryId: summaryId,
          message: 'Messages created successfully'
        });
      } catch (summaryError) {
        console.error('Error generating summary:', summaryError);
        // Don't fail the request if summary generation fails
        res.status(201).json({
          userMessage: userMessageWithDetails,
          aiResponse: aiMessageWithDetails,
          summaryGenerated: false,
          message: 'Messages created successfully (summary generation failed)'
        });
      }
    } catch (aiError) {
      console.error('Error generating AI response:', aiError);

      // Return just the user message if AI fails
      const userMessageWithDetails = await RequirementMessageModel.findByIdWithDetails(userMessage.id);

      res.status(201).json({
        userMessage: userMessageWithDetails,
        message: 'User message created successfully (AI response failed)',
        aiError: aiError instanceof Error ? aiError.message : 'Unknown AI error'
      });
    }
  } catch (error) {
    console.error('Error in message conversation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process conversation'
    });
  }
});

// Get refinement sessions for a requirement
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

    const sessions = await RefinementSessionModel.findByRequirementId(requirementId);

    res.json({
      sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Error fetching requirement sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement sessions'
    });
  }
});

// Get summaries for a refinement session
router.get('/:id/summaries', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id: sessionId } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(sessionId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const summaries = await RefinementSummaryModel.findBySessionId(sessionId);

    res.json({
      summaries,
      total: summaries.length
    });
  } catch (error) {
    console.error('Error fetching session summaries:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch session summaries'
    });
  }
});

// Get latest summary for a refinement session
router.get('/:id/summary/latest', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id: sessionId } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(sessionId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const summary = await RefinementSummaryModel.findLatestBySessionId(sessionId);

    if (!summary) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No summary found for this session'
      });
    }

    res.json({
      summary
    });
  } catch (error) {
    console.error('Error fetching latest session summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch latest session summary'
    });
  }
});

// Generate a new summary for a session (manual trigger)
router.post('/:id/summary/generate', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id: sessionId } = req.params;
    const { summary_type } = req.body;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(sessionId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    // Get session details to get project_id
    const session = await RefinementSessionModel.findByIdWithDetails(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    const summaryId = await SummaryGeneratorService.generateSummaryForSession(sessionId, {
      userId: user.id,
      projectId: session.requirement.project_id,
      summaryType: summary_type || 'conversation_progress',
      forceGenerate: true
    });

    if (!summaryId) {
      return res.status(400).json({
        error: 'Generation Failed',
        message: 'Unable to generate summary (session may be empty)'
      });
    }

    const summary = await RefinementSummaryModel.findById(summaryId);

    res.status(201).json({
      summary,
      message: 'Summary generated successfully'
    });
  } catch (error) {
    console.error('Error generating session summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate session summary'
    });
  }
});

export default router;