# MEMORY.md - Long-Term Memory

## File Organization
- **MEMORY.md** — Stable knowledge: architecture, conventions, preferences, key facts. Not for schedules or action items.
- **HEARTBEAT.md** — Recurring schedules, reminders, and periodic tasks. When David adds/changes a recurring event or bill, update HEARTBEAT.md, not here.

## Smart Home
- **Nest thermostat** is set up and working. See TOOLS.md for usage commands.
- For temperature/thermostat questions, run: `python3 ~/.openclaw/skills/nest-devices/scripts/nest.py list`

## Cron Task Architecture
- Cron jobs live in `/home/ubuntu/.openclaw/cron/jobs.json`
- **Custom scripts live in `/home/ubuntu/.openclaw/workspace/scripts/`** (respects write-workspace boundary)
- The job's `payload.message` tells the cron agent to run the script and relay stdout
- When David says **"task"**, interpret it contextually as: the `.js` script, the cron job entry, or both
- To modify what a task *does*: edit the `.js` script in `workspace/scripts/`
- To modify *when/how* a task runs: edit the cron job in `jobs.json`
- To create a new task: write a new `.js` script in `workspace/scripts/` AND create a cron job that runs it
- Scripts output their message to stdout; cron relays it. Complex logic belongs in the script, not the payload.message
