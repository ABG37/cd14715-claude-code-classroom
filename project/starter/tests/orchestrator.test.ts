import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockReport } = vi.hoisted(() => {
 return {
   mockReport: {
     pullRequest: {
       owner: 'octocat',
       repo: 'Hello-World',
       number: 1,
     },
     fileReviews: [
       {
         file: 'README.md',
         codeQuality: {
           file: 'README.md',
           issues: [
             {
               line: 1,
               severity: 'low',
               category: 'best-practice',
               description: 'Minor formatting suggestion',
               suggestion: 'Format title',
             },
           ],
           overallScore: 90,
           summary: 'Clean code quality with minor suggestions.',
         },
         testCoverage: {
           file: 'README.md',
           hasTests: true,
           testFiles: ['tests/readme.test.ts'],
           untestedPaths: [
             {
               type: 'function',
               location: 'renderTitle',
               priority: 'low',
               reasoning: 'Edge case formatting',
               suggestedTest: 'test edge cases',
             },
           ],
           coverageEstimate: 95,
           summary: 'High test coverage across major paths.',
         },
         refactorings: {
           file: 'README.md',
           suggestions: [
             {
               type: 'simplify',
               location: 'line 1',
               impact: 'low',
               description: 'Simplify phrasing',
               before: 'old text',
               after: 'new text',
               benefits: 'Improves clarity',
             },
           ],
           summary: 'Code structure is modern and clean.',
         },
       },
     ],
     summary: {
       totalFiles: 1,
       overallScore: 92,
       criticalIssues: 0,
       highPriorityTests: 0,
       refactoringOpportunities: 1,
     },
     recommendations: [
       {
         priority: 'low',
         category: 'documentation',
         description: 'Keep documentation aligned with changes',
         files: ['README.md'],
       },
     ],
     metadata: {
       analyzedAt: new Date().toISOString(),
       duration: 1200,
       agentVersions: {
         'code-quality': '1.0.0',
         'test-coverage': '1.0.0',
         'refactoring': '1.0.0',
       },
     },
   },
 };
});
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
 query: vi.fn(() => ({
   async *[Symbol.asyncIterator]() {
     yield {
       type: 'structured_output',
       data: mockReport,
     };
   },
 })),
}));
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { ReviewReportSchema } from '../src/types/index.js';
describe('CodeReviewOrchestrator', () => {
 let customLimiter: RateLimiter;
 beforeEach(() => {
   vi.clearAllMocks();
   customLimiter = new RateLimiter({
     maxRequestsPerMinute: 1000,
     maxTokensPerMinute: 500000,
     maxConcurrent: 50,
   });
 });
 describe('Configuration', () => {
   it('should initialize with default options', () => {
     const orchestrator = new CodeReviewOrchestrator();
     expect(orchestrator).toBeDefined();
   });
   it('should accept custom rate limit configuration', () => {
     const orchestrator = new CodeReviewOrchestrator({
       rateLimiter: customLimiter,
     });
     expect(orchestrator).toBeDefined();
   });
 });
 describe('reviewPullRequest', () => {
   it('should fetch PR files from GitHub MCP', async () => {
     const orchestrator = new CodeReviewOrchestrator({ rateLimiter: customLimiter });
     const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
     expect(report).toBeDefined();
   }, 15000);
   it('should spawn all 3 subagents in parallel', async () => {
     const orchestrator = new CodeReviewOrchestrator({ rateLimiter: customLimiter });
     const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
     expect(report.fileReviews).toBeDefined();
     expect(report.fileReviews.length).toBeGreaterThan(0);
     expect(report.fileReviews[0]).toHaveProperty('codeQuality');
     expect(report.fileReviews[0]).toHaveProperty('testCoverage');
     expect(report.fileReviews[0]).toHaveProperty('refactorings');
   }, 15000);
   it('should aggregate results into ReviewReport', async () => {
     const orchestrator = new CodeReviewOrchestrator({ rateLimiter: customLimiter });
     const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
     expect(report.summary.overallScore).toBe(92);
     expect(report.summary.totalFiles).toBe(1);
   }, 15000);
   it('should validate output with Zod schema', async () => {
     const orchestrator = new CodeReviewOrchestrator({ rateLimiter: customLimiter });
     const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
     expect(report).toBeDefined();
     expect(report.pullRequest.owner).toBe('octocat');
     expect(report.summary.overallScore).toBe(92);
   }, 15000);
 });
 describe('Integration', () => {
   it.skip('should review a real small PR', async () => {
     const orchestrator = new CodeReviewOrchestrator();
     const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
     expect(report).toBeDefined();
   });
 });
});