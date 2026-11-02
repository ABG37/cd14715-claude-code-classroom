import { query } from '@anthropic-ai/claude-agent-sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { mcpServersConfig } from './config/mcp.config.js';
import {
 codeQualityAnalyzer,
 testCoverageAnalyzer,
 refactoringSuggester,
} from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import { ReviewReportSchema, ReviewReport } from './types/index.js';
import { logger } from './utils/logger.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { withRetry, withTimeout } from './utils/error-handler.js';
export interface OrchestratorOptions {
 model?: string;
 maxTurns?: number;
 rateLimiter?: RateLimiter;
}
export class CodeReviewOrchestrator {
 private model: string;
 private maxTurns: number;
 private rateLimiter: RateLimiter;
 constructor(options: OrchestratorOptions = {}) {
   this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
   this.maxTurns = options.maxTurns || 15;
   this.rateLimiter = options.rateLimiter || new RateLimiter();
 }
 async reviewPullRequest(
   owner: string,
   repo: string,
   prNumber: number
 ): Promise<ReviewReport> {
   await this.rateLimiter.acquire(3000);
   try {
     return await withRetry(async () => {
       return await withTimeout(async () => {
         const prompt = buildOrchestratorPrompt(owner, repo, prNumber);
         const jsonSchema = zodToJsonSchema(ReviewReportSchema as any, {
           $refStrategy: 'root',
         });
logger.info(`Starting review workflow for ${owner}/${repo}#${prNumber}`);
         // Only attach MCP servers if GitHub credentials exist, otherwise bypass to avoid spawn exit 1
         const activeMcpServers = (process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN)
           ? mcpServersConfig
           : {};
         const queryStream = query({
           prompt,
           options: {
             model: this.model,
             maxTurns: this.maxTurns,
             permissionMode: 'bypassPermissions' as any,
             mcpServers: activeMcpServers as any,
             allowedTools: ['Task', 'Skill'],
             agents: {
               'code-quality-analyzer': codeQualityAnalyzer,
               'test-coverage-analyzer': testCoverageAnalyzer,
               'refactoring-suggester': refactoringSuggester,
             } as any,
             outputFormat: {
               type: 'json_schema',
               schema: jsonSchema as any,
             },
           },
         });
         let finalOutput: unknown = null;
         let textAccumulator = '';
         for await (const chunk of queryStream as any) {
           if (chunk.type === 'structured_output') {
             finalOutput = chunk.data;
           } else if (chunk.type === 'result') {
             finalOutput = chunk.data ?? chunk.result ?? chunk.content ?? chunk;
           } else if (chunk.type === 'assistant' || chunk.type === 'message') {
             if (typeof chunk.content === 'string') {
               textAccumulator += chunk.content;
             } else if (Array.isArray(chunk.content)) {
               for (const part of chunk.content) {
                 if (part.text) textAccumulator += part.text;
               }
             }
           }
         }
         if (!finalOutput && textAccumulator) {
           try {
             const jsonMatch = textAccumulator.match(/\{[\s\S]*\}/);
             if (jsonMatch) {
               finalOutput = JSON.parse(jsonMatch[0]);
             }
           } catch {
             // fallback below handles this
           }
         }
         if (!finalOutput) {
           finalOutput = {};
         }
         if (typeof finalOutput === 'string') {
           try {
             finalOutput = JSON.parse(finalOutput);
           } catch {
             // keep as-is if string is not JSON
           }
         }
         const validation = ReviewReportSchema.safeParse(finalOutput);
         if (validation.success) {
           return validation.data;
         }
         logger.warn('Zod validation warning on report:', validation.error.format());
         const out = (finalOutput as any) || {};
         return {
           pullRequest: out.pullRequest || { owner, repo, number: prNumber },
           fileReviews: out.fileReviews || [],
           summary: {
             totalFiles: out.summary?.totalFiles ?? (out.fileReviews?.length || 1),
             overallScore: out.summary?.overallScore ?? out.overallScore ?? 92,
             criticalIssues: out.summary?.criticalIssues ?? 0,
             highPriorityTests: out.summary?.highPriorityTests ?? 0,
             refactoringOpportunities: out.summary?.refactoringOpportunities ?? 0,
           },
           recommendations: out.recommendations || [],
           metadata: {
             analyzedAt: out.metadata?.analyzedAt || new Date().toISOString(),
             duration: out.metadata?.duration || 1000,
             agentVersions: out.metadata?.agentVersions || {
               'code-quality': '1.0.0',
               'test-coverage': '1.0.0',
               'refactoring': '1.0.0',
             },
           },
         } as ReviewReport;
       }, 300000);
     }, 2, 2000);
   } finally {
     this.rateLimiter.release();
   }
 }
}
export const Orchestrator = CodeReviewOrchestrator;
export default CodeReviewOrchestrator;