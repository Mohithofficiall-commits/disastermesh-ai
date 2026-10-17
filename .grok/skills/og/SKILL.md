# Brand Asset Skill

## Brand-asset pass:
The brand-asset pass produces site card assets. It touches `/workspace/.grok/og-pending` which expires after 10 minutes.
No wait_tasks, never get_task_output on it.
Check status with:
`node scripts/brand-check.mjs --placeholder-ok`

## Atomic writes:
Use write-atomic to safely move assets:
`node scripts/write-atomic.mjs /workspace/.grok/og.tmp /workspace/public/og.jpg`
`node scripts/write-atomic.mjs /workspace/.grok/x-banner.tmp /workspace/public/x-banner.jpg`
`node scripts/write-atomic.mjs /workspace/.grok/site.tmp /workspace/src/lib/og/site.json`
