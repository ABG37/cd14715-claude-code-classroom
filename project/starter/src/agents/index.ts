/**
* Subagent exports
*/
import {
 CODE_QUALITY_ANALYZER_PROMPT,
 TEST_COVERAGE_ANALYZER_PROMPT,
 REFACTORING_SUGGESTER_PROMPT,
} from '../prompts/index.js';
export const codeQualityAnalyzer = {
 name: 'code-quality-analyzer',
 description: 'Audits pull request diffs for security vulnerabilities, performance bottlenecks, and adherence to clean coding standards.',
 prompt: CODE_QUALITY_ANALYZER_PROMPT,
 systemPrompt: CODE_QUALITY_ANALYZER_PROMPT,
 model: 'inherit' as const,
 tools: ['Skill'],
};
export const testCoverageAnalyzer = {
 name: 'test-coverage-analyzer',
 description: 'Evaluates pull request code changes to spot untested branches/functions and prescribes concrete unit test cases with assertions.',
 prompt: TEST_COVERAGE_ANALYZER_PROMPT,
 systemPrompt: TEST_COVERAGE_ANALYZER_PROMPT,
 model: 'inherit' as const,
 tools: [] as string[],
};
export const refactoringSuggester = {
 name: 'refactoring-suggester',
 description: 'Proposes modern syntax refactorings, architectural modularity improvements, and dead code pruning with before-and-after code snippets.',
 prompt: REFACTORING_SUGGESTER_PROMPT,
 systemPrompt: REFACTORING_SUGGESTER_PROMPT,
 model: 'inherit' as const,
 tools: [] as string[],
};
export const codeQualityAnalyzerAgent = codeQualityAnalyzer;
export const testCoverageAnalyzerAgent = testCoverageAnalyzer;
export const refactoringSuggesterAgent = refactoringSuggester;
export const agents = [
 codeQualityAnalyzer,
 testCoverageAnalyzer,
 refactoringSuggester,
];
export default agents;