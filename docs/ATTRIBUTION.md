# Commit attribution

This repository is authored by **Khang Thai**. This note records how authorship
is consolidated and what is left to do if you want the GitHub contributors
sidebar to match.

## What is already in place

**`.mailmap`** maps every historical author identity onto the repository owner.
Git honours it natively, so all of these now report a single author:

```bash
git shortlog -sne     # 67 commits, one human author
git log --format='%aN'
git blame <file>
```

**Local git identity** is set so new commits are authored correctly from the
start:

```bash
git config user.name  "Khang Thai"
git config user.email "61812548+kunfupen@users.noreply.github.com"
```

## What `.mailmap` cannot do

GitHub's **contributors sidebar and contribution graph do not read `.mailmap`**.
They key off the raw author email recorded in each commit object. 30 commits in
this repository's history carry `noreply@anthropic.com`, and only rewriting those
commit objects will change that view.

## Rewriting history (optional, destructive)

This rewrites every commit SHA and requires a force-push. Do it when nobody else
has outstanding clones or branches.

```bash
# 1. Back out an escape hatch first.
git branch backup/pre-rewrite main

# 2. Rewrite author and committer identity on the affected commits.
git filter-branch -f --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "noreply@anthropic.com" ]; then
  export GIT_AUTHOR_NAME="Khang Thai"
  export GIT_AUTHOR_EMAIL="61812548+kunfupen@users.noreply.github.com"
fi
if [ "$GIT_COMMITTER_EMAIL" = "noreply@anthropic.com" ]; then
  export GIT_COMMITTER_NAME="Khang Thai"
  export GIT_COMMITTER_EMAIL="61812548+kunfupen@users.noreply.github.com"
fi' -- --all

# 3. Confirm before publishing — this should list one human author.
git shortlog -sne --no-mailmap

# 4. Publish.
git push --force-with-lease origin main
```

`git filter-repo` is the modern, faster equivalent if you have it installed:

```bash
git filter-repo --mailmap .mailmap
```

### After a rewrite

- Every SHA changes, so open pull requests and any other clone must be re-based
  or re-cloned.
- GitHub recalculates the contributors graph within a few minutes.
- Delete `backup/pre-rewrite` once you are satisfied.

> Merge commits made by GitHub itself are authored by the account that clicked
> merge, and `github-actions[bot]` commits come from the scheduled tracker. Those
> are genuine and are intentionally left alone.
