---
description: Trunk-based development workflow with CI/CD integration
---

# Trunk-Based Development Workflow for DrJiraPokerPlanner

This workflow implements trunk-based development best practices optimized for the current CI/CD pipeline.

## Branch Strategy

**Main Branches:**

- `main` - Production-ready code (auto-deploys to production)
- `development` - Integration branch (auto-deploys to development environment)

**Short-Lived Feature Branches:**

- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

## Daily Development Workflow

### 1. Start New Work

```bash
# Always start from latest development
git checkout development
git pull origin development

# Create a short-lived feature branch
git checkout -b feature/your-feature-name
```

**Naming conventions:**

- `feature/poker-timer-improvements`
- `fix/vote-reveal-bug`
- `refactor/storage-service`
- `docs/update-readme`

### 2. Make Small, Incremental Commits

```bash
# Make focused changes
git add <files>
git commit -m "feat: add timer pause functionality"

# Push frequently (at least daily)
git push origin feature/your-feature-name
```

**Commit message format:**

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `test:` - Test additions/changes
- `chore:` - Build/tooling changes

### 3. Keep Branch Fresh (Rebase Daily)

```bash
# Fetch latest changes
git fetch origin development

# Rebase your work on top of development
git rebase origin/development

# Force push (safe because it's your branch)
git push --force-with-lease origin feature/your-feature-name
```

**Why rebase?**

- Keeps linear history
- Easier to review
- Prevents merge conflicts from accumulating

### 4. Integrate to Development (Merge, Don't PR)

```bash
# Ensure your branch is up to date
git checkout development
git pull origin development

# Merge your feature (fast-forward preferred)
git merge --ff-only feature/your-feature-name

# If fast-forward fails, rebase first
# git checkout feature/your-feature-name
# git rebase development
# git checkout development
# git merge --ff-only feature/your-feature-name

# Push to trigger CI/CD
git push origin development

# Delete feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

**This triggers:**

1. QA checks (lint, type check, tests)
2. Deployment to development environment
3. Automatic promotion to main (production)

### 5. Monitor CI/CD Pipeline

```bash
# Watch GitHub Actions
# https://github.com/<your-org>/DrJiraPokerPlanner/actions

# If deployment fails, fix immediately
git checkout development
git checkout -b fix/deployment-issue
# ... make fixes ...
git checkout development
git merge --ff-only fix/deployment-issue
git push origin development
```

## Emergency Hotfix Workflow

### Critical Production Bug

**Note:** The CI/CD pipeline accepts direct pushes to `main` for emergency hotfixes. This bypasses the normal development → main promotion flow.

```bash
# Branch from main (production)
git checkout main
git pull origin main
git checkout -b fix/critical-production-bug

# Make minimal fix
git add <files>
git commit -m "fix: resolve critical voting bug"

# Merge to main and push (triggers immediate production deployment)
git checkout main
git merge --ff-only fix/critical-production-bug
git push origin main  # ⚠️ Triggers: QA → Versioning → Production

# Backport to development to keep branches in sync
git checkout development
git merge main
git push origin development

# Delete hotfix branch
git branch -d fix/critical-production-bug
```

**What happens:**

1. Push to `main` triggers QA checks
2. Semantic version tag is created
3. Production deployment runs
4. Automatic rollback if deployment fails

## Best Practices

### ✅ DO

1. **Commit frequently** - At least 2-3 times per day
2. **Keep branches short-lived** - Maximum 2-3 days
3. **Rebase daily** - Stay synchronized with development
4. **Run tests locally** - Before pushing
5. **Write descriptive commits** - Use conventional commit format
6. **Delete merged branches** - Keep repository clean
7. **Fix broken builds immediately** - Don't let CI stay red

### ❌ DON'T

1. **Don't create long-lived branches** - Increases merge conflicts
2. **Don't merge without testing** - Always verify locally first
3. **Don't commit directly to main** - Use development branch
4. **Don't ignore CI failures** - Fix or revert immediately
5. **Don't hoard changes** - Integrate frequently
6. **Don't use merge commits** - Prefer fast-forward merges
7. **Don't work on multiple features in one branch** - Keep focused

## Code Review (Optional but Recommended)

For significant changes, use GitHub's draft PR feature:

```bash
# Create PR from feature branch to development
gh pr create --base development --head feature/your-feature --draft

# Request review from team
gh pr ready  # Mark as ready for review

# After approval, merge via command line (not GitHub UI)
git checkout development
git merge --ff-only feature/your-feature
git push origin development
```

## Rollback Procedure

### Automatic Rollback

The CI/CD pipeline automatically rolls back production if deployment fails.

### Manual Rollback

```bash
# Find the last good version
git tag --sort=-creatordate | head -5

# Checkout that version
git checkout v1.2.24

# Deploy manually
forge deploy -e production

# Or create a revert commit
git checkout main
git revert <bad-commit-sha>
git push origin main
```

## Storage and State Management

**Important:** Forge Storage is shared across environments!

- Development and Production share the same storage keys
- Use environment-specific prefixes: `dev_poker_room_*` vs `prod_poker_room_*`
- Or use separate Atlassian sites for dev/prod

## Pre-Push Checklist

Before pushing to development:

```bash
# 1. Run linter
npm run lint

# 2. Type check
cd static/poker-planner-ui && npx tsc --noEmit

# 3. Run tests
cd static/poker-planner-ui && npm test

# 4. Build locally
npm run build

# 5. Test in local Forge environment (optional)
forge tunnel
```

## Monitoring Deployments

```bash
# Check deployment status
forge deploy -e development --non-interactive

# View logs
forge logs -e development --follow

# Check installed version
forge install list
```

## Tips for Success

1. **Small batches** - Integrate code at least daily
2. **Feature flags** - Use for incomplete features
3. **Backward compatibility** - Don't break existing functionality
4. **Monitor production** - Check logs after deployment
5. **Communicate** - Let team know about breaking changes
