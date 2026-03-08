import json

# Standard tuning (semitones from C=0)
TUNING = {'E': 4, 'A': 9, 'D': 2, 'G': 7, 'B': 11, 'e': 4}
STRINGS = ['E', 'A', 'D', 'G', 'B', 'e']  # low to high
NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

TRIAD_TYPES = {
    'Major':      {'intervals': [0, 4, 7],  'labels': ['R', '3',  '5' ]},
    'Minor':      {'intervals': [0, 3, 7],  'labels': ['R', 'm3', '5' ]},
    'Diminished': {'intervals': [0, 3, 6],  'labels': ['R', 'm3', '5-']},
    'Augmented':  {'intervals': [0, 4, 8],  'labels': ['R', '3',  '5+']},
}

def note_at_fret(string, fret):
    return (TUNING[string] + fret) % 12

def fret_for_note(string, note_semitone):
    """Returns the lowest fret (0-11) on a string that plays the given note."""
    return (note_semitone - TUNING[string]) % 12

triads = []

for root_idx, root_name in enumerate(NOTES):
    for type_name, ttype in TRIAD_TYPES.items():
        intervals = ttype['intervals']
        labels = ttype['labels']

        tone_semitones = [(root_idx + iv) % 12 for iv in intervals]
        tone_names = [NOTES[s] for s in tone_semitones]

        chord_tones = {labels[i]: tone_names[i] for i in range(3)}

        # Try all adjacent string triples (low to high)
        for i in range(4):
            s1, s2, s3 = STRINGS[i], STRINGS[i+1], STRINGS[i+2]

            # Place root on s1
            f1 = fret_for_note(s1, tone_semitones[0])
            f2 = fret_for_note(s2, tone_semitones[1])
            f3 = fret_for_note(s3, tone_semitones[2])

            # Skip if any fret is unreasonably high (>12) or if voicing spans >5 frets
            all_frets = [f1, f2, f3]
            if max(all_frets) > 12:
                continue
            if max(all_frets) - min(all_frets) > 5:
                continue

            name = f"{root_name} {type_name} (root fret {f1}, {s1} string)"

            strings_map = {s: -1 for s in STRINGS}
            strings_map[s1] = f1
            strings_map[s2] = f2
            strings_map[s3] = f3

            triads.append({
                "name": name,
                "root": root_name,
                "chord_tones": chord_tones,
                "strings": strings_map
            })

# Also try root on s2 and s3 of each triple for more variety
for root_idx, root_name in enumerate(NOTES):
    for type_name, ttype in TRIAD_TYPES.items():
        intervals = ttype['intervals']
        labels = ttype['labels']
        tone_semitones = [(root_idx + iv) % 12 for iv in intervals]
        tone_names = [NOTES[s] for s in tone_semitones]
        chord_tones = {labels[i]: tone_names[i] for i in range(3)}

        for i in range(4):
            s1, s2, s3 = STRINGS[i], STRINGS[i+1], STRINGS[i+2]

            # Root on middle string
            f2 = fret_for_note(s2, tone_semitones[0])
            f1 = fret_for_note(s1, tone_semitones[2])  # 5th below
            f3 = fret_for_note(s3, tone_semitones[1])  # 3rd above

            all_frets = [f1, f2, f3]
            if max(all_frets) > 12:
                continue
            if max(all_frets) - min(all_frets) > 5:
                continue

            name = f"{root_name} {type_name} (root fret {f2}, {s2} string)"
            if any(t['name'] == name for t in triads):
                continue

            strings_map = {s: -1 for s in STRINGS}
            strings_map[s1] = f1
            strings_map[s2] = f2
            strings_map[s3] = f3

            triads.append({
                "name": name,
                "root": root_name,
                "chord_tones": chord_tones,
                "strings": strings_map
            })

output = {
    "sent_triads": [],
    "available_triads": triads
}

with open('/home/ubuntu/.openclaw/workspace/sent_triads.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"Generated {len(triads)} triads")
