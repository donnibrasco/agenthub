import { SessionEvent, DriftIncident, ProposedRule } from '../types';

/**
 * Detects patterns of developer correction and agent drift from raw session events.
 */
export function analyzeSessionForDrift(
  sessionId: string,
  agentName: string,
  events: SessionEvent[]
): DriftIncident[] {
  const incidents: DriftIncident[] = [];

  // Look for developer corrections (e.g. "no, don't", "stop using", "fix lint", "you forgot")
  const correctionEvents = events.filter(e => e.type === 'correction');

  for (const corr of correctionEvents) {
    const text = corr.content.toLowerCase();
    
    if (text.includes('tailwind') || text.includes('inline style') || text.includes('custom css')) {
      incidents.push({
        id: `drift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        agentName,
        title: 'Styling Discipline Drift (Inline Styles vs Tailwind)',
        category: 'architecture_drift',
        description: 'Agent repeatedly wrote custom styles or ignored Tailwind utility conventions.',
        detectedSnippet: corr.content,
        developerCorrection: corr.content,
        suggestedRuleId: 'rule_tailwind_only',
        timestamp: corr.timestamp,
        status: 'pending'
      });
    } else if (text.includes('type') || text.includes('typescript') || text.includes('interface')) {
      incidents.push({
        id: `drift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        agentName,
        title: 'TypeScript Strictness Drift',
        category: 'anti_pattern',
        description: 'Agent introduced "any" types or missed type annotations on exported functions.',
        detectedSnippet: corr.content,
        developerCorrection: corr.content,
        suggestedRuleId: 'rule_strict_types',
        timestamp: corr.timestamp,
        status: 'pending'
      });
    } else if (text.includes('test') || text.includes('lint') || text.includes('broken build')) {
      incidents.push({
        id: `drift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        agentName,
        title: 'Pre-Commit Verification Drift',
        category: 'tool_discipline',
        description: 'Agent finished task without running unit tests or lint check.',
        detectedSnippet: corr.content,
        developerCorrection: corr.content,
        suggestedRuleId: 'rule_verify_before_finish',
        timestamp: corr.timestamp,
        status: 'pending'
      });
    } else {
      incidents.push({
        id: `drift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        agentName,
        title: 'Developer Intent Alignment Drift',
        category: 'lost_context',
        description: 'Agent lost track of project constraints and required explicit developer nudge.',
        detectedSnippet: corr.content,
        developerCorrection: corr.content,
        suggestedRuleId: 'rule_context_check',
        timestamp: corr.timestamp,
        status: 'pending'
      });
    }
  }

  return incidents;
}

/**
 * Generates an automated rule proposal from a drift incident
 */
export function generateRuleFromDrift(incident: DriftIncident): ProposedRule {
  switch (incident.suggestedRuleId) {
    case 'rule_tailwind_only':
      return {
        id: 'rule_tailwind_only',
        title: 'Enforce Tailwind CSS Utilities & Zero Inline Styles',
        category: 'code_style',
        targetFile: '.cursorrules',
        ruleSnippet: '- Always use Tailwind CSS utility classes; never emit inline style objects or separate CSS modules.\n- For dark mode, use Tailwind dark:* utilities.',
        reason: 'Detected 3 repetitive developer corrections regarding styling consistency.',
        frequency: 3,
        status: 'suggested',
        diffPreview: {
          target: '.cursorrules',
          before: '# Cursor Project Rules\n\n- TypeScript strict mode',
          after: '# Cursor Project Rules\n\n- TypeScript strict mode\n+ Always use Tailwind CSS utility classes (no inline style objects)\n+ Use dark:* variants for themes'
        }
      };

    case 'rule_verify_before_finish':
      return {
        id: 'rule_verify_before_finish',
        title: 'Mandatory Test & Lint Verification Before Finishing',
        category: 'tool_discipline',
        targetFile: 'AGENT_RULES.md',
        ruleSnippet: '- Always run npm run lint and unit tests before declaring task complete.\n- Fix any type errors before presenting code to developer.',
        reason: 'Agent broke the build on 2 consecutive turns without checking errors.',
        frequency: 2,
        status: 'suggested',
        diffPreview: {
          target: 'AGENT_RULES.md',
          before: '## Verification\nMake sure the app builds.',
          after: '## Verification\nMake sure the app builds.\n+ Run `npm run lint` and `npm test` after all code edits.\n+ Never finish turn with broken types or unresolved imports.'
        }
      };

    default:
      return {
        id: `rule_${Date.now()}`,
        title: `Auto-Learned: ${incident.title}`,
        category: 'architecture',
        targetFile: 'CLAUDE.md',
        ruleSnippet: `- Invariant: ${incident.developerCorrection.replace(/^no,?\s*/i, '')}`,
        reason: `Generated from developer correction: "${incident.developerCorrection.slice(0, 60)}"`,
        frequency: 1,
        status: 'suggested',
        diffPreview: {
          target: 'CLAUDE.md',
          before: '# Project Guidelines',
          after: `# Project Guidelines\n+ Invariant: ${incident.developerCorrection.replace(/^no,?\s*/i, '')}`
        }
      };
  }
}
