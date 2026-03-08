# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## SSH

### quentin (app hosted on app server)
- Host: `16.58.23.107`
- User: `batty`
- Key: `/home/ubuntu/.openclaw/workspace/batty-16.58.23.107`
- App path: `/home/bitnami/apps/quentin`
- Logs: `/home/bitnami/apps/quentin/logs/`

## Nest Thermostat

Skill: `~/.openclaw/skills/nest-devices/SKILL.md`

For temperature, mode, or thermostat questions, run:
```bash
python3 ~/.openclaw/skills/nest-devices/scripts/nest.py list    # status
python3 ~/.openclaw/skills/nest-devices/scripts/nest.py set-temp DEVICE_ID 70 --unit f --type heat
python3 ~/.openclaw/skills/nest-devices/scripts/nest.py set-mode DEVICE_ID HEAT
```

Credentials are in env vars (`NEST_PROJECT_ID`, `NEST_CLIENT_ID`, `NEST_CLIENT_SECRET`, `NEST_REFRESH_TOKEN`).
