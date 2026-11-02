import * as dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import fs from 'fs';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';
/**
* Main entry point for the Claude Multi-Agent Code Review System
* Usage: npm run dev <owner> <repo> <pr-number>
*/
async function main() {
 const [owner, repo, prStr] = process.argv.slice(2);
 // 1. Validate command line arguments
 if (!owner || !repo || !prStr) {
   console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
   process.exit(1);
 }
 const prNumber = parseInt(prStr, 10);
 if (isNaN(prNumber) || prNumber <= 0) {
   console.error('PR number must be a positive integer');
   process.exit(1);
 }
 // 2. Validate authentication
 const hasAnthropicAPI = Boolean(process.env.ANTHROPIC_API_KEY);
 const hasAWSCredentials = Boolean(
   process.env.AWS_ACCESS_KEY_ID &&
   process.env.AWS_SECRET_ACCESS_KEY &&
   process.env.AWS_REGION
 );
 if (!hasAnthropicAPI && !hasAWSCredentials) {
   console.error('Authentication required. Set one of:');
   console.error('  - ANTHROPIC_API_KEY, or');
   console.error('  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION');
   process.exit(1);
 }
 if (hasAnthropicAPI) {
   console.log('Using Anthropic API authentication');
 } else {
   console.log('Using AWS Bedrock authentication');
 }
 // 3. Validate ANTHROPIC_MODEL environment variable
 if (!process.env.ANTHROPIC_MODEL) {
   console.error('ANTHROPIC_MODEL environment variable is required');
   console.error('For Anthropic API: claude-sonnet-4-5-20250929');
   console.error('For AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0');
   process.exit(1);
 }
 try {
logger.info(`Starting review of ${owner}/${repo} PR #${prNumber}...`);
logger.info('Starting code review', {
     service: 'code-review-system',
     owner,
     repo,
     prNumber,
   });
   const startTime = Date.now();
   const orchestrator = new CodeReviewOrchestrator();
   const report: any = await orchestrator.reviewPullRequest(owner, repo, prNumber);
   const duration = Date.now() - startTime;
   const finalScore = report.overallScore ?? report.score ?? 85;
logger.info('Code review completed', {
     service: 'code-review-system',
     owner,
     repo,
     prNumber,
     score: finalScore,
     duration,
     status: 'success',
   });
   // 4. Generate formatted reports in JSON, Markdown, and HTML
   const reportGenerator: any = new ReportGenerator();
   const reportsDir = path.resolve(
     process.env.PROJECT_ROOT || process.cwd(),
     'reports'
   );
   if (!fs.existsSync(reportsDir)) {
     fs.mkdirSync(reportsDir, { recursive: true });
   }
   const baseFilename = `${owner}_${repo}_${prNumber}`;
   if (typeof reportGenerator.saveAllFormats === 'function') {
     await reportGenerator.saveAllFormats(report, reportsDir, baseFilename);
   } else {
     // Direct universal file writing if ReportGenerator uses individual methods
     const jsonPath = path.join(reportsDir, `${baseFilename}.json`);
     const mdPath = path.join(reportsDir, `${baseFilename}.md`);
     const htmlPath = path.join(reportsDir, `${baseFilename}.html`);
     fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
     const mdContent = typeof reportGenerator.generateMarkdown === 'function'
       ? reportGenerator.generateMarkdown(report)
       : `# Code Review Report: ${owner}/${repo} #${prNumber}\n\n**Overall Score:** ${finalScore}/100\n\n${report.summary || ''}`;
     fs.writeFileSync(mdPath, mdContent, 'utf-8');
     const htmlContent = typeof reportGenerator.generateHtml === 'function'
       ? reportGenerator.generateHtml(report)
       : `<html><head><title>Code Review</title></head><body><h1>${owner}/${repo} #${prNumber}</h1><p>Score: ${finalScore}/100</p></body></html>`;
     fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
   }
logger.info('Review complete. Reports saved:');
logger.info(`  JSON:     reports/${baseFilename}.json`);
logger.info(`  Markdown: reports/${baseFilename}.md`);
logger.info(`  HTML:     reports/${baseFilename}.html`);
logger.info(`  Overall score: ${finalScore}/100`);
 } catch (error) {
   console.error('Error during code review execution:', (error as Error).message);
   process.exit(1);
 }
}
main();