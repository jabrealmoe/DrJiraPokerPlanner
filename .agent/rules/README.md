# Project Rules

This directory contains project-specific rules and conventions for AI assistants working on the DrJiraPokerPlanner codebase.

## Purpose

These rules help ensure:

- **Consistency** - Code follows the same patterns throughout
- **Quality** - Best practices are applied automatically
- **Efficiency** - Common decisions are pre-made
- **Onboarding** - New developers (human or AI) understand conventions quickly

## Rules Files

### [coding-standards.md](./coding-standards.md)

General coding standards covering:

- Naming conventions
- Code organization
- Function guidelines
- Testing standards
- Git commit standards
- Documentation standards

**When to reference:** For any code changes, refactoring, or new features.

### [forge-best-practices.md](./forge-best-practices.md)

Atlassian Forge-specific best practices covering:

- Runtime limitations
- Storage best practices
- Jira API usage
- Custom UI patterns
- Performance optimization
- Deployment strategies

**When to reference:** For Forge-specific implementations, API calls, or deployment changes.

## How AI Assistants Use These Rules

When working on this project, AI assistants should:

1. **Read relevant rules** before making significant changes
2. **Follow conventions** outlined in these documents
3. **Suggest improvements** if rules seem outdated
4. **Document exceptions** when breaking rules is necessary

## Adding New Rules

Create new rule files for:

- **Domain-specific patterns** (e.g., `voting-logic-patterns.md`)
- **Integration guidelines** (e.g., `n8n-webhook-integration.md`)
- **UI/UX standards** (e.g., `design-system-usage.md`)
- **Testing strategies** (e.g., `e2e-testing-patterns.md`)

## Updating Rules

Rules should evolve with the project:

- Update when patterns change
- Add examples from real code
- Remove outdated practices
- Keep concise and actionable

## Example Usage

**Scenario:** Adding a new resolver function

1. Check `coding-standards.md` for naming conventions
2. Check `forge-best-practices.md` for storage patterns
3. Follow error handling guidelines
4. Use conventional commit message format

**Result:** Consistent, high-quality code that follows project standards.
