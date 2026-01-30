---
description: Solo developer workflow with conventional commits and CI/CD
---

# Solo Developer Workflow with Conventional Commits

This workflow is optimized for solo development with automated CI/CD. No PRs needed - just clean commits and fast iteration.

## Quick Reference

```bash
# Daily workflow
git checkout development
git pull origin development
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: add new feature"
git checkout development
git merge --ff-only feature/my-feature
git push origin development
# ✅ Auto-deploys to dev → prod
```

---

## Conventional Commit Format

Your commits drive **semantic versioning** automatically. Use this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types

| Type        | Version Bump              | When to Use             | Example                                   |
| ----------- | ------------------------- | ----------------------- | ----------------------------------------- |
| `feat:`     | **MINOR** (1.2.0 → 1.3.0) | New feature             | `feat: add timer pause button`            |
| `fix:`      | **PATCH** (1.2.0 → 1.2.1) | Bug fix                 | `fix: resolve vote reveal race condition` |
| `perf:`     | **PATCH**                 | Performance improvement | `perf: add caching to session queries`    |
| `refactor:` | **PATCH**                 | Code refactoring        | `refactor: extract voting service`        |
| `docs:`     | No bump                   | Documentation only      | `docs: update README deployment section`  |
| `test:`     | No bump                   | Test additions/changes  | `test: add E2E tests for voting flow`     |
| `chore:`    | No bump                   | Build/tooling changes   | `chore: upgrade Forge CLI to v7.0`        |
| `style:`    | No bump                   | Code style/formatting   | `style: fix linting errors`               |
| `ci:`       | No bump                   | CI/CD changes           | `ci: add linting to GitHub Actions`       |

### Breaking Changes

For **MAJOR** version bumps (1.2.0 → 2.0.0), add `BREAKING CHANGE:` in footer:

```bash
git commit -m "feat: redesign voting API

BREAKING CHANGE: submitVote now requires roomKey instead of issueId"
```

Or use `!` after type:

```bash
git commit -m "feat!: redesign voting API"
```

### Scope (Optional)

Add scope for clarity:

```bash
git commit -m "feat(voting): add timer pause functionality"
git commit -m "fix(storage): prevent duplicate session keys"
git commit -m "refactor(backend): extract session service"
```

**Common scopes:**

- `voting` - Voting logic
- `session` - Session management
- `storage` - Forge Storage
- `ui` - Frontend components
- `backend` - Backend resolvers
- `ci` - CI/CD pipeline
- `admin` - Admin page

---

## Daily Development Workflow

### 1. Start New Work

```bash
# Always start from latest development
git checkout development
git pull origin development

# Create feature branch (optional but recommended)
git checkout -b feature/timer-pause
```

**Branch naming:**

- `feature/timer-pause`
- `fix/vote-reveal-bug`
- `refactor/storage-service`
- `perf/add-caching`

### 2. Make Changes and Commit

```bash
# Make your changes
# ... edit files ...

# Stage changes
git add .

# Commit with conventional format
git commit -m "feat(voting): add timer pause button"
```

**Commit message examples:**

```bash
# New feature
git commit -m "feat(voting): add timer pause functionality"

# Bug fix
git commit -m "fix(session): prevent duplicate participants"

# Performance improvement
git commit -m "perf(storage): add in-memory caching layer"

# Refactoring
git commit -m "refactor(backend): extract voting service"

# Documentation
git commit -m "docs: update deployment instructions"

# Multiple files, detailed description
git commit -m "feat(admin): add deck customization UI

- Add custom deck input field
- Validate deck values on save
- Update admin page styling"
```

### 3. Deploy to Development

```bash
# Merge to development
git checkout development
git merge --ff-only feature/timer-pause

# Push to trigger CI/CD
git push origin development
```

**What happens automatically:**

1. ✅ QA checks (type check, tests)
2. ✅ Deploy to development environment
3. ✅ Auto-promote to main
4. ✅ Create version tag (based on commit type!)
5. ✅ Deploy to production
6. ✅ Create GitHub release

### 4. Monitor Deployment

```bash
# Watch GitHub Actions
# https://github.com/<your-org>/DrJiraPokerPlanner/actions

# Or check logs
forge logs -e development --follow
```

### 5. Clean Up

```bash
# Delete feature branch (optional)
git branch -d feature/timer-pause
```

---

## Fast Iteration (Skip Feature Branches)

For small changes, work directly on development:

```bash
# Pull latest
git checkout development
git pull origin development

# Make changes
# ... edit files ...

# Commit and push
git add .
git commit -m "fix(ui): correct button alignment"
git push origin development
# ✅ Auto-deploys immediately
```

**Use this for:**

- ✅ Quick bug fixes
- ✅ Documentation updates
- ✅ Small UI tweaks
- ✅ Typo fixes

**Don't use for:**

- ❌ Large features (use feature branch)
- ❌ Breaking changes (use feature branch + testing)
- ❌ Experimental code (use feature branch)

---

## Emergency Hotfix Workflow

For critical production bugs:

```bash
# Branch from main (production)
git checkout main
git pull origin main
git checkout -b fix/critical-voting-bug

# Make minimal fix
# ... edit files ...

# Commit with fix type
git add .
git commit -m "fix(voting): resolve critical reveal bug"

# Merge to main and push
git checkout main
git merge --ff-only fix/critical-voting-bug
git push origin main
# ⚠️ Deploys directly to production!

# Backport to development
git checkout development
git merge main
git push origin development

# Clean up
git branch -d fix/critical-voting-bug
```

---

## Commit Message Templates

### Feature

```bash
git commit -m "feat(scope): add feature description

- Implementation detail 1
- Implementation detail 2
- Implementation detail 3"
```

### Bug Fix

```bash
git commit -m "fix(scope): resolve issue description

Root cause: Explain what was wrong
Solution: Explain the fix"
```

### Breaking Change

```bash
git commit -m "feat(api): redesign voting endpoint

BREAKING CHANGE: submitVote now requires roomKey parameter instead of issueId.
Migration: Update all invoke('submitVote') calls to include roomKey."
```

### Refactoring

```bash
git commit -m "refactor(backend): extract session service

- Move session logic to SessionService
- Add unit tests for service
- Update resolvers to use service"
```

---

## Version Bump Examples

Based on your commits, here's what versions will be created:

```bash
# Current version: v1.2.5

git commit -m "fix: button alignment"
# → v1.2.6 (patch bump)

git commit -m "feat: add timer pause"
# → v1.3.0 (minor bump)

git commit -m "feat!: redesign API"
# → v2.0.0 (major bump)

git commit -m "docs: update README"
# → v1.2.5 (no bump)
```

---

## Best Practices

### ✅ DO

1. **Write clear, descriptive commits**

   ```bash
   # Good
   git commit -m "feat(voting): add timer pause with 10s intervals"

   # Bad
   git commit -m "feat: stuff"
   ```

2. **Commit frequently** - Small, focused commits

   ```bash
   git commit -m "feat(ui): add pause button component"
   git commit -m "feat(backend): add pauseTimer resolver"
   git commit -m "feat(voting): integrate pause functionality"
   ```

3. **Use present tense** - "add feature" not "added feature"

   ```bash
   # Good
   git commit -m "fix: resolve race condition"

   # Bad
   git commit -m "fix: resolved race condition"
   ```

4. **Keep subject line under 72 characters**

   ```bash
   # Good
   git commit -m "feat(voting): add pause timer functionality"

   # Bad
   git commit -m "feat(voting): add the ability to pause the timer during voting sessions"
   ```

5. **Use body for details** - Explain WHY, not WHAT

   ```bash
   git commit -m "perf(storage): add in-memory caching

   Reduces Forge Storage reads by 80% and improves response time.
   Cache TTL is 5 seconds to balance freshness and performance."
   ```

### ❌ DON'T

1. **Don't mix types in one commit**

   ```bash
   # Bad
   git commit -m "feat: add feature and fix bug and update docs"

   # Good - Split into 3 commits
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve existing bug"
   git commit -m "docs: update documentation"
   ```

2. **Don't use vague descriptions**

   ```bash
   # Bad
   git commit -m "fix: fix stuff"
   git commit -m "feat: updates"

   # Good
   git commit -m "fix(voting): prevent duplicate votes"
   git commit -m "feat(admin): add custom deck configuration"
   ```

3. **Don't commit broken code**

   ```bash
   # Always test before committing
   npm run build
   npm test
   git commit -m "feat: new feature"
   ```

4. **Don't skip the type**

   ```bash
   # Bad
   git commit -m "add new feature"

   # Good
   git commit -m "feat: add new feature"
   ```

---

## Amending Commits

If you make a mistake in your last commit:

```bash
# Fix the commit message
git commit --amend -m "feat(voting): correct description"

# Add forgotten files
git add forgotten-file.js
git commit --amend --no-edit

# ⚠️ Only amend if you haven't pushed yet!
```

---

## Viewing Commit History

```bash
# View recent commits
git log --oneline -10

# View commits with details
git log --pretty=format:"%h - %s (%an, %ar)"

# View commits by type
git log --oneline --grep="^feat:"
git log --oneline --grep="^fix:"

# View version tags
git tag --sort=-creatordate | head -10
```

---

## Troubleshooting

### Issue: Wrong commit type used

**Solution:** Amend before pushing

```bash
git commit --amend -m "fix: correct type from feat to fix"
```

### Issue: Forgot to add scope

**Solution:** Amend before pushing

```bash
git commit --amend -m "feat(voting): add scope to commit"
```

### Issue: Need to undo last commit

**Solution:** Reset (if not pushed)

```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes, undo commit
git reset --hard HEAD~1
```

### Issue: Pushed wrong commit

**Solution:** Revert (creates new commit)

```bash
git revert HEAD
git push origin development
```

---

## Commit Message Checklist

Before committing, verify:

- [ ] Starts with valid type (`feat`, `fix`, `refactor`, etc.)
- [ ] Has clear, descriptive subject (under 72 chars)
- [ ] Uses present tense ("add" not "added")
- [ ] Includes scope if relevant (`feat(voting):`)
- [ ] Body explains WHY if needed
- [ ] Marks breaking changes if applicable
- [ ] Code builds and tests pass

---

## Examples from This Project

**Good commits:**

```bash
git commit -m "feat(voting): add timer pause functionality"
git commit -m "fix(session): prevent duplicate participant entries"
git commit -m "perf(storage): implement in-memory caching layer"
git commit -m "refactor(backend): extract session service from monolithic resolver"
git commit -m "docs(readme): update deployment instructions for CI/CD"
git commit -m "test(voting): add E2E tests for reveal flow"
git commit -m "chore(deps): upgrade Forge CLI to v7.0"
```

**Breaking change:**

```bash
git commit -m "feat(api): redesign storage key structure

BREAKING CHANGE: Storage keys now use environment prefixes.
Migration required: Run migration script to update existing keys."
```

---

## Tips for Solo Development

1. **Commit often** - Don't wait for "perfect" code
2. **Push daily** - Backup your work to GitHub
3. **Use descriptive messages** - Future you will thank you
4. **Test before pushing** - CI/CD will catch errors, but local testing is faster
5. **Monitor deployments** - Check GitHub Actions after pushing
6. **Use feature branches for experiments** - Easy to abandon if needed
7. **Keep commits focused** - One logical change per commit

---

## Quick Command Reference

```bash
# Start work
git checkout development && git pull

# Quick fix (no branch)
git add . && git commit -m "fix: description" && git push

# Feature work (with branch)
git checkout -b feature/name
git add . && git commit -m "feat: description"
git checkout development && git merge --ff-only feature/name
git push && git branch -d feature/name

# Emergency hotfix
git checkout main && git checkout -b fix/critical
git add . && git commit -m "fix: critical issue"
git checkout main && git merge --ff-only fix/critical && git push
git checkout development && git merge main && git push

# View history
git log --oneline -10

# Amend last commit (before push)
git commit --amend -m "new message"
```

---

**Remember:** Your commits create your version tags automatically! Write good commit messages and semantic versioning happens magically. ✨
