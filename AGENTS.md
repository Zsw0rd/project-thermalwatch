# AegisFire Repository Instructions

These instructions apply to every file and subdirectory in this repository.

## Required living documentation

Whenever an agent changes code, configuration, infrastructure, data fixtures, tests, architecture, or user-facing behavior, it must update `PROJECT_LOG.md` in the same work session.

Every log entry must include:

- the date;
- the objective;
- files or areas touched;
- decisions and important implementation details;
- verification performed and its result;
- known limitations or the next concrete task.

Whenever research is performed, a source is introduced, a technical assumption changes, or a specialized term becomes important, update `RESEARCH_REFERENCE_GLOSSARY.md` in the same work session. Keep source links beside the claims they support and distinguish verified facts from engineering assumptions.

Do not delete earlier log or research history merely to make the documents shorter. Correct obsolete information by marking it superseded and adding the replacement.

## Product priorities

1. The web experience is the primary deliverable.
2. Build an explainable intelligence product, not a clone of the NASA FIRMS map.
3. Preserve source attribution for every evidence channel.
4. Maintain a deterministic offline demo mode so the judging flow never depends on live services.
5. Treat classifications as evidence-backed likelihoods, never as confirmation of an accident.

## Engineering expectations

- Keep TypeScript strict and Python typed where practical.
- Keep secrets server-side and out of Git.
- Add or update tests for important behavior.
- Run relevant lint, type, test, and build checks before declaring work complete.
- Preserve raw source fields alongside normalized data when ingestion is implemented.

