---
description: Monitor GitHub Actions CI/CD pipeline runs
---

# Monitor GitHub Actions CI/CD

Quick commands to watch and troubleshoot your GitHub Actions deployments.

## Prerequisites

Install GitHub CLI if you haven't already:

```bash
# macOS
brew install gh

# Authenticate
gh auth login
```

## Quick Commands

### Watch Latest Run

```bash
# Watch the most recent workflow run
gh run watch

# Watch specific run by ID
gh run watch 1234567890

# Watch and show logs
gh run watch --exit-status
```

### List Recent Runs

```bash
# List last 10 runs
gh run list --limit 10

# List only failed runs
gh run list --status failure

# List runs for specific workflow
gh run list --workflow=main.yml
```

### View Run Details

```bash
# View run in browser
gh run view --web

# View specific run
gh run view 1234567890

# View run logs
gh run view 1234567890 --log
```

### Check Run Status

```bash
# Get status of latest run
gh run list --limit 1

# Get status of specific run
gh run view 1234567890 --json status,conclusion
```

---

## Workflow-Specific Monitoring

### After Pushing to Development

```bash
# 1. Push your changes
git push origin development

# 2. Watch the deployment
gh run watch

# 3. If it fails, view logs
gh run view --log-failed
```

### After Pushing to Main (Hotfix)

```bash
# 1. Push hotfix
git push origin main

# 2. Watch production deployment
gh run watch

# 3. Check if rollback triggered
gh run list --limit 5
```

---

## Common Scenarios

### Scenario 1: "Did my deployment succeed?"

```bash
# Quick status check
gh run list --limit 1

# Expected output:
# ✓ Streamlined Forge CI/CD  main  push  1234567890  success
```

### Scenario 2: "Why did my deployment fail?"

```bash
# View failed job logs
gh run view --log-failed

# Or view specific job
gh run view 1234567890 --job 5678901234 --log
```

### Scenario 3: "Is production deployed yet?"

```bash
# Watch the run and wait for completion
gh run watch --exit-status

# Exit code 0 = success
# Exit code 1 = failure
```

### Scenario 4: "I need to cancel a bad deployment"

```bash
# Cancel the latest run
gh run cancel $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')

# Or cancel specific run
gh run cancel 1234567890
```

### Scenario 5: "Re-run a failed deployment"

```bash
# Re-run failed jobs only
gh run rerun 1234567890 --failed

# Re-run entire workflow
gh run rerun 1234567890
```

---

## Pipeline Stages to Monitor

Your CI/CD has 5 stages. Here's what to watch for:

### Stage 1: QA (Lint & Unit Tests)

```bash
# If this fails, check:
# - Type errors: cd static/poker-planner-ui && npx tsc --noEmit
# - Test failures: cd static/poker-planner-ui && npm test
```

### Stage 2: Deploy Dev & Auto-Promote

```bash
# If this fails, check:
# - Forge credentials (FORGE_EMAIL, FORGE_API_TOKEN)
# - GitHub PAT (GH_PAT) for auto-promotion
# - Development environment availability
```

### Stage 3: Semantic Versioning

```bash
# If this fails, check:
# - Commit message format (must be conventional commits)
# - GitHub token permissions
```

### Stage 4: Deploy Production

```bash
# If this fails, check:
# - Production environment availability
# - Forge production credentials
# - Build artifacts from previous stage
```

### Stage 5: Rollback (if Stage 4 fails)

```bash
# Automatic rollback to previous version
# Check logs to see which version was restored
```

---

## Advanced Monitoring

### Watch Multiple Runs

```bash
# In one terminal: watch latest
gh run watch

# In another terminal: list all recent
watch -n 5 'gh run list --limit 5'
```

### Export Run Data

```bash
# Get run data as JSON
gh run view 1234567890 --json \
  status,conclusion,createdAt,updatedAt,url \
  > run-data.json

# Get all recent runs
gh run list --limit 20 --json \
  databaseId,status,conclusion,createdAt,headBranch \
  > recent-runs.json
```

### Filter by Branch

```bash
# Only show development runs
gh run list --branch development

# Only show main runs
gh run list --branch main
```

### Filter by Event

```bash
# Only show push events
gh run list --event push

# Only show manual workflow dispatches
gh run list --event workflow_dispatch
```

---

## Troubleshooting

### Issue: `gh: command not found`

**Solution:**

```bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login
```

### Issue: "No workflow runs found"

**Solution:**

```bash
# Make sure you're in the right repo
cd /Users/jabrealj/tutorial-forge-n8n/DrJiraPokerPlanner

# Check if workflows exist
gh workflow list
```

### Issue: "Insufficient permissions"

**Solution:**

```bash
# Re-authenticate with correct scopes
gh auth login --scopes repo,workflow
```

### Issue: "Run is still queued"

**Solution:**

```bash
# GitHub Actions may be queued if:
# - Too many concurrent runs
# - GitHub Actions is experiencing issues
# - Waiting for approval (if required)

# Check GitHub status
open https://www.githubstatus.com
```

---

## Useful Aliases

Add these to your `~/.zshrc` or `~/.bashrc`:

```bash
# Watch latest run
alias ghw='gh run watch'

# List recent runs
alias ghl='gh run list --limit 10'

# View latest run in browser
alias ghv='gh run view --web'

# View failed logs
alias ghf='gh run view --log-failed'

# Cancel latest run
alias ghc='gh run cancel $(gh run list --limit 1 --json databaseId --jq ".[0].databaseId")'
```

Then use:

```bash
ghw      # Watch latest run
ghl      # List recent runs
ghv      # View in browser
ghf      # View failed logs
ghc      # Cancel latest run
```

---

## Integration with Forge

### After Deployment, Check Forge

```bash
# 1. Wait for deployment to complete
gh run watch --exit-status

# 2. Check Forge logs
forge logs -e production --follow

# 3. Verify installation
forge install list
```

### Full Deployment Verification

```bash
# Complete verification script
#!/bin/bash

echo "🚀 Deploying to development..."
git push origin development

echo "⏳ Waiting for CI/CD..."
gh run watch --exit-status

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful!"
  echo "📋 Checking Forge logs..."
  forge logs -e production --follow
else
  echo "❌ Deployment failed!"
  echo "📋 Viewing error logs..."
  gh run view --log-failed
  exit 1
fi
```

---

## Quick Reference

| Task               | Command                                |
| ------------------ | -------------------------------------- |
| Watch latest run   | `gh run watch`                         |
| Watch specific run | `gh run watch 1234567890`              |
| List recent runs   | `gh run list --limit 10`               |
| View in browser    | `gh run view --web`                    |
| View logs          | `gh run view --log`                    |
| View failed logs   | `gh run view --log-failed`             |
| Cancel run         | `gh run cancel 1234567890`             |
| Re-run failed jobs | `gh run rerun 1234567890 --failed`     |
| Get run status     | `gh run view 1234567890 --json status` |
| List by branch     | `gh run list --branch development`     |
| List failures only | `gh run list --status failure`         |

---

## Pro Tips

1. **Use `--exit-status` to block until completion**

   ```bash
   gh run watch --exit-status && echo "Deployed!" || echo "Failed!"
   ```

2. **Pipe to jq for custom output**

   ```bash
   gh run list --json status,conclusion,headBranch --jq '.[] | select(.conclusion=="failure")'
   ```

3. **Set up notifications**

   ```bash
   # macOS notification when run completes
   gh run watch --exit-status && osascript -e 'display notification "Deployment complete!" with title "GitHub Actions"'
   ```

4. **Create a deployment dashboard**

   ```bash
   watch -n 10 'gh run list --limit 5 --json status,conclusion,createdAt,headBranch | jq -r ".[] | \"\(.status) | \(.conclusion) | \(.headBranch)\""'
   ```

5. **Check before pushing**
   ```bash
   # Make sure previous run completed before pushing
   gh run list --limit 1 --json status --jq '.[0].status' | grep -q "completed" && git push || echo "Previous run still in progress!"
   ```

---

**Remember:** Your CI/CD is fully automated. Once you push, just watch and let it do its thing! 🚀
