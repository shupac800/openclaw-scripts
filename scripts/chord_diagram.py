#!/usr/bin/env python
"""Generate PNG chord diagram images for guitar triads.

Each image shows three sections left to right:
  1. Tab diagram (fret numbers on strings)
  2. Interval legend (R, 3, 5, etc.)
  3. Staff notation with key signature
"""

import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ---------- constants ----------

SCRIPT_DIR = Path(__file__).resolve().parent
STATIC_DIR = SCRIPT_DIR / "static"
TRIADS_PATH = SCRIPT_DIR.parent / "sent_triads.json"

# Fonts (Windows paths)
FONT_MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 18)
FONT_LABEL = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
FONT_TITLE = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 17)
FONT_SYMBOL = "C:/Windows/Fonts/seguisym.ttf"  # path for dynamically sized clef/accidentals

# Image dimensions
IMG_H = 168

# Guitar tuning: open string MIDI note numbers
OPEN_MIDI = {"E": 40, "A": 45, "D": 50, "G": 55, "B": 59, "e": 64}
STRING_ORDER = ["e", "B", "G", "D", "A", "E"]
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
OPEN_SEMITONES = {"E": 4, "A": 9, "D": 2, "G": 7, "B": 11, "e": 4}

FLAT_MAP = {
    "Eb": "D#", "Bb": "A#", "Ab": "G#", "Db": "C#",
    "Gb": "F#", "Fb": "E", "Cb": "B",
}
INTERVAL_NAME_MAP = {
    "R": "R", "1": "R", "b3": "m3", "m3": "m3", "3": "3",
    "b5": "dim5", "5-": "dim5", "dim5": "dim5", "5": "5",
    "#5": "aug5", "5+": "aug5", "aug5": "aug5",
}
INTERVAL_ORDER = ["R", "m3", "3", "dim5", "5", "aug5"]

# Staff: treble clef, bottom line = E4 (position 0)
# Each integer step = one staff line (2 diatonic steps)
# position 0=E4, 0.5=F4, 1=G4, 1.5=A4, 2=B4, 2.5=C5, 3=D5, 3.5=E5, 4=F5
# Below: -0.5=D4, -1=C4 (ledger), -1.5=B3, -2=A3 (ledger)

# Diatonic note names in order (C=0)
DIATONIC = ["C", "D", "E", "F", "G", "A", "B"]

# Staff position for each (note_name, octave) pair
def note_to_staff_position(note_name, octave):
    """Return staff position (0 = bottom line E4). Half-steps are spaces."""
    base = note_name.rstrip("#b")
    diatonic_idx = DIATONIC.index(base)
    # E4 = reference. E is diatonic index 2, octave 4
    ref_abs = 4 * 7 + 2  # absolute diatonic position of E4
    abs_pos = octave * 7 + diatonic_idx
    return (abs_pos - ref_abs) * 0.5


def get_written_pitch(string, fret):
    """Return (note_name, octave) for a string/fret, written pitch (guitar +1 octave)."""
    midi = OPEN_MIDI[string] + fret + 12  # guitar writes one octave up
    octave = (midi // 12) - 1
    note_idx = midi % 12
    return NOTE_NAMES[note_idx], octave


# Key signatures: sharps/flats for major keys
SHARP_ORDER = ["F#", "C#", "G#", "D#", "A#", "E#", "B#"]
FLAT_ORDER = ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"]

# Staff positions for sharp/flat glyphs in key signature (treble clef)
SHARP_POSITIONS = [4, 2.5, 4.5, 3, 1.5, 3.5, 2]  # F5, C5, G5, D5, A4, E5, B4
FLAT_POSITIONS = [2, 3.5, 1.5, 3, 1, 2.5, 0.5]    # B4, E5, A4, D5, G4, C5, F4

KEY_SHARPS = {
    "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6, "C#": 7,
}
KEY_FLATS = {
    "F": 1, "Bb": 2, "Eb": 3, "Ab": 4, "Db": 5, "Gb": 6, "Cb": 7,
}

# Minor/dim/aug -> key signature mapping
def get_key_signature(root, quality):
    """Return (accidentals_list, positions_list, glyph) for the key signature.

    quality: 'Major', 'Minor', 'Diminished', 'Augmented'
    Assumes chord is tonic. Minor uses natural minor (relative major).
    Augmented uses major key. Diminished uses the half-dim convention (minor key).
    """
    if quality in ("Major", "Augmented"):
        key = root
    elif quality in ("Minor", "Diminished"):
        # Use relative major: minor root + 3 semitones = relative major root
        root_norm = FLAT_MAP.get(root, root)
        idx = NOTE_NAMES.index(root_norm)
        rel_idx = (idx + 3) % 12
        key = NOTE_NAMES[rel_idx]
        # Convert sharp names to enharmonic flat names where conventional
        enharmonic = {"A#": "Bb", "D#": "Eb", "G#": "Ab"}
        key = enharmonic.get(key, key)
    else:
        key = root

    if key in KEY_SHARPS:
        n = KEY_SHARPS[key]
        return SHARP_ORDER[:n], SHARP_POSITIONS[:n], "\u266F"
    elif key in KEY_FLATS:
        n = KEY_FLATS[key]
        return FLAT_ORDER[:n], FLAT_POSITIONS[:n], "\u266D"
    else:
        return [], [], ""


# ---------- drawing helpers ----------

TAB_STRING_SPACING = 17
TAB_LINE_LEFT = 30       # where the horizontal line starts (after string label)
TAB_LINE_WIDTH = 120     # length of horizontal line
TAB_FRET_FONT = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
TAB_STRING_FONT = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 14)
TAB_LABEL_FONT = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 13)

STAFF_LINES = 5

COLOR_BG = (0, 0, 0)               # black background
COLOR_FG = "white"                 # white foreground text
COLOR_LINE = (155, 155, 155)       # grey for tab/staff lines
COLOR_FRET = (255, 255, 255)       # white for fret numbers (default)
COLOR_MUTE = (95, 95, 95)          # dark grey for muted strings
COLOR_LABEL = (195, 195, 195)      # light grey for interval labels (default)

# Interval color coding (day-glo / high-visibility)
COLOR_ROOT = (255, 255, 0)         # bright yellow
COLOR_THIRD = (255, 50, 50)        # hot red (covers 3 and m3)
COLOR_FIFTH = (0, 160, 255)        # electric blue (covers 5, dim5, aug5)

INTERVAL_COLORS = {
    "R": COLOR_ROOT,
    "3": COLOR_THIRD,
    "m3": COLOR_THIRD,
    "5": COLOR_FIFTH,
    "dim5": COLOR_FIFTH,
    "aug5": COLOR_FIFTH,
}


import math

NOTEHEAD_TILT = math.radians(-20)  # 20 degrees upper-right (negative for screen Y-axis)
NOTEHEAD_ASPECT = 1.45             # width:height ratio


def _notehead_polygon(cx, cy, half_space):
    """Generate a tilted ellipse polygon for a filled notehead.

    half_space: half the distance between staff lines (= line_spacing / 2).
    The notehead height nearly fills one staff space.
    """
    ry = half_space * 0.92
    rx = ry * NOTEHEAD_ASPECT
    cos_t = math.cos(NOTEHEAD_TILT)
    sin_t = math.sin(NOTEHEAD_TILT)

    points = []
    steps = 72
    for i in range(steps):
        theta = 2 * math.pi * i / steps
        x = rx * math.cos(theta)
        y = ry * math.sin(theta)
        # Rotate by tilt
        xr = x * cos_t - y * sin_t
        yr = x * sin_t + y * cos_t
        points.append((cx + xr, cy + yr))
    return points


def _staff_y(staff_top, position, line_spacing):
    """Convert staff position to pixel Y coordinate."""
    # Position 4 = top line, position 0 = bottom line
    return staff_top + (4 - position) * line_spacing


def _build_tone_map(triad):
    """Build {normalized_note: {interval, original}} from triad chord_tones."""
    tone_map = {}
    for interval, note in triad["chord_tones"].items():
        normalized = FLAT_MAP.get(note, note)
        display = INTERVAL_NAME_MAP.get(interval, interval)
        tone_map[normalized] = {"interval": display, "original": note}
    return tone_map


def draw_tab_section(draw, x, y, triad, ss=1):
    """Draw graphical tab with lines, fret numbers, and interval=note labels."""
    tone_map = _build_tone_map(triad)

    # Scaled fonts
    fret_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15 * ss)
    string_font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 14 * ss)
    label_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 13 * ss)

    ll = TAB_LINE_LEFT * ss
    lw = TAB_LINE_WIDTH * ss
    sp = TAB_STRING_SPACING * ss

    line_left = x + ll
    line_right = line_left + lw
    fret_center_x = line_left + lw // 2
    label_x = line_right + 12 * ss

    for i, s in enumerate(STRING_ORDER):
        sy = y + i * sp
        fret = triad["strings"][s]

        # String label
        lbl_bbox = string_font.getbbox(s)
        lbl_w = lbl_bbox[2] - lbl_bbox[0]
        lbl_h = lbl_bbox[3] - lbl_bbox[1]
        draw.text((x + ll - lbl_w - 8 * ss, sy - lbl_h / 2 - lbl_bbox[1]),
                  s, fill=COLOR_FRET, font=string_font)

        # All strings get the same line
        draw.line([(line_left, sy), (line_right, sy)],
                  fill=COLOR_LINE, width=ss)

        if fret == -1:
            pass
        else:
            f_str = str(fret)
            f_bbox = fret_font.getbbox(f_str)
            f_w = f_bbox[2] - f_bbox[0]
            f_h = f_bbox[3] - f_bbox[1]
            f_x = fret_center_x - f_w / 2 - f_bbox[0]
            f_y = sy - f_h / 2 - f_bbox[1]
            pad = 3 * ss
            draw.rectangle(
                [(f_x - pad, sy - f_h / 2 - ss), (f_x + f_w + pad, sy + f_h / 2 + ss)],
                fill=COLOR_BG,
            )
            semitone = (OPEN_SEMITONES[s] + fret) % 12
            note_name = NOTE_NAMES[semitone]
            entry = tone_map.get(note_name)
            interval_color = INTERVAL_COLORS.get(
                entry["interval"], COLOR_FRET) if entry else COLOR_FRET

            draw.text((f_x, f_y), f_str, fill=interval_color, font=fret_font)

            if entry:
                label = f"{entry['interval']}  {entry['original']}"
                l_bbox = label_font.getbbox(label)
                l_h = l_bbox[3] - l_bbox[1]
                draw.text((label_x, sy - l_h / 2 - l_bbox[1]),
                          label, fill=interval_color, font=label_font)


def draw_staff_section(draw, x, staff_top, staff_bottom, triad, ss=1):
    """Draw staff with clef, key signature, noteheads, and interval labels."""
    tone_map = _build_tone_map(triad)
    line_spacing = (staff_bottom - staff_top) / (STAFF_LINES - 1)

    # Label font scaled
    label_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 13 * ss)

    # Measure how wide key sig + notes will be, then set staff width
    quality = _extract_quality(triad["name"])
    accidentals, positions, glyph = get_key_signature(triad["root"], quality)
    acc_spacing = line_spacing * 0.55
    acc_width = int(len(accidentals) * acc_spacing)
    clef_w = int(line_spacing * 3.2)
    staff_width = clef_w + acc_width + 28 * ss + 30 * ss + 16 * ss
    staff_right = x + staff_width

    # Draw staff lines
    for i in range(STAFF_LINES):
        ly = staff_top + i * line_spacing
        draw.line([(x, ly), (staff_right, ly)], fill=COLOR_LINE, width=ss)

    # Treble clef — the G clef curl sits on the G4 line (2nd line from bottom).
    # Standard engraving: clef extends from ~bottom line up to ~1 space above
    # the top line, so total height ≈ 5 line-spacings (1.25× staff height).
    # The curl (G4) is at roughly 58% down from the glyph top.
    target_clef_h = line_spacing * 5
    # Bootstrap: measure glyph at a reference size, then scale proportionally
    ref_size = max(int(line_spacing * 5), 1)
    ref_font = ImageFont.truetype(FONT_SYMBOL, ref_size)
    ref_bbox = ref_font.getbbox("\U0001D11E")
    ref_h = ref_bbox[3] - ref_bbox[1]
    clef_font_size = max(int(ref_size * target_clef_h / ref_h), 1)
    clef_font = ImageFont.truetype(FONT_SYMBOL, clef_font_size)
    clef_bbox = clef_font.getbbox("\U0001D11E")
    clef_h = clef_bbox[3] - clef_bbox[1]
    g4_y = _staff_y(staff_top, 1, line_spacing)
    clef_y = g4_y - clef_h * 0.58 - clef_bbox[1]
    draw.text((x + 4 * ss, clef_y), "\U0001D11E", fill=(128, 128, 128), font=clef_font)

    # Accidental font — standard engraving: sharp ≈ 2.8 staff spaces tall,
    # flat ≈ 2.5 staff spaces tall. We target 2.5× line_spacing glyph height.
    target_acc_h = line_spacing * 2.5
    ref_acc_sz = max(int(line_spacing * 2), 1)
    ref_acc_font = ImageFont.truetype(FONT_SYMBOL, ref_acc_sz)
    ref_acc_bbox = ref_acc_font.getbbox("\u266F")
    ref_acc_h = ref_acc_bbox[3] - ref_acc_bbox[1]
    acc_font_size = max(int(ref_acc_sz * target_acc_h / ref_acc_h), 1)
    acc_font = ImageFont.truetype(FONT_SYMBOL, acc_font_size)

    # Key signature accidentals
    acc_x = x + clef_w
    for i, pos in enumerate(positions):
        ay = _staff_y(staff_top, pos, line_spacing)
        acc_bbox = acc_font.getbbox(glyph)
        acc_h = acc_bbox[3] - acc_bbox[1]
        # Sharps: center vertically on the line. Flats: the loop (lower portion,
        # ~65% from top) should sit on the line.
        if glyph == "\u266D":  # flat
            gy = ay - acc_h * 0.65 - acc_bbox[1]
        else:  # sharp
            gy = ay - acc_h * 0.50 - acc_bbox[1]
        draw.text((acc_x + int(i * acc_spacing), gy),
                  glyph, fill=COLOR_FG, font=acc_font)

    # Collect notes — extra gap after key signature before the chord
    note_x = acc_x + acc_width + 28 * ss
    notes = []
    for s in STRING_ORDER:
        fret = triad["strings"][s]
        if fret == -1:
            continue
        note_name, octave = get_written_pitch(s, fret)
        pos = note_to_staff_position(note_name.rstrip("#b"), octave)
        # Look up interval via the sounding note (not written)
        semitone = (OPEN_SEMITONES[s] + fret) % 12
        sounding = NOTE_NAMES[semitone]
        entry = tone_map.get(sounding)
        notes.append((note_name, octave, pos, entry))

    notes.sort(key=lambda n: n[2])

    # Horizontal offset for seconds
    x_offsets = [0] * len(notes)
    for i in range(1, len(notes)):
        if abs(notes[i][2] - notes[i - 1][2]) <= 0.5:
            x_offsets[i] = 16 * ss

    # Scale ledger and accidental sizes to staff
    half_space = line_spacing / 2
    notehead_visual_rx = half_space * 0.92 * NOTEHEAD_ASPECT
    ledger_half = int(notehead_visual_rx + 4 * ss)
    acc_offset_x = int(line_spacing * 1.5)
    acc_offset_y = int(line_spacing * 0.75)

    # Collect all ledger line positions needed, then draw them once
    ledger_positions = set()
    for i, (note_name, octave, pos, entry) in enumerate(notes):
        if pos < 0:
            lp = 0
            while lp - 1 >= pos:
                lp -= 1
                if lp == int(lp):
                    ledger_positions.add(int(lp))
        elif pos > 4:
            lp = 4
            while lp + 1 <= pos:
                lp += 1
                if lp == int(lp):
                    ledger_positions.add(int(lp))

    # Draw ledger lines spanning all noteheads
    if ledger_positions:
        all_nx = [note_x + x_offsets[i] for i in range(len(notes))]
        ledger_left = min(all_nx) - ledger_half
        ledger_right = max(all_nx) + ledger_half
        for lp in sorted(ledger_positions):
            ly = _staff_y(staff_top, lp, line_spacing)
            draw.line([(ledger_left, ly), (ledger_right, ly)],
                      fill=COLOR_LINE, width=ss)

    # Draw noteheads and labels
    label_x = staff_right + 8 * ss
    acc_list = accidentals

    # Compute label Y positions with minimum 3px gap between adjacent labels.
    # Notes are sorted bottom-to-top (ascending position = descending Y).
    # Measure label height once for gap calculations.
    sample_bbox = label_font.getbbox("Rg")
    label_h = sample_bbox[3] - sample_bbox[1]
    min_gap = 3 * ss  # 3px at final resolution
    min_center_dist = label_h + min_gap

    label_ys = []
    for i, (note_name, octave, pos, entry) in enumerate(notes):
        label_ys.append(_staff_y(staff_top, pos, line_spacing))
    # label_ys are in descending order (bottom note = highest Y comes first
    # since notes sorted by ascending position). Actually notes sorted ascending
    # by pos, so label_ys go from high Y (bottom) to low Y (top).
    # Enforce min spacing: sweep from top (last) to bottom (first),
    # pushing labels down if too close to the one above.
    for j in range(len(label_ys) - 2, -1, -1):
        if label_ys[j] - label_ys[j + 1] < min_center_dist:
            label_ys[j] = label_ys[j + 1] + min_center_dist

    for i, (note_name, octave, pos, entry) in enumerate(notes):
        ny = _staff_y(staff_top, pos, line_spacing)
        nx = note_x + x_offsets[i]

        # Interval color for this note
        note_color = INTERVAL_COLORS.get(
            entry["interval"], COLOR_FG) if entry else COLOR_FG

        # Note accidental (sharp/flat not in key signature)
        if "#" in note_name:
            note_acc = note_name.rstrip("#") + "#"
            if note_acc not in acc_list:
                draw.text((nx - acc_offset_x, ny - acc_offset_y), "\u266F",
                          fill=note_color, font=acc_font)
        elif "b" in note_name:
            if note_name not in acc_list:
                draw.text((nx - acc_offset_x, ny - acc_offset_y), "\u266D",
                          fill=note_color, font=acc_font)

        # Filled notehead (tilted superellipse)
        head_pts = _notehead_polygon(nx, ny, line_spacing / 2)
        draw.polygon(head_pts, fill=note_color)

        # Interval + note label to the right of staff
        if entry:
            label = f"{entry['interval']}  {entry['original']}"
            l_bbox = label_font.getbbox(label)
            l_h = l_bbox[3] - l_bbox[1]
            draw.text((label_x, label_ys[i] - l_h / 2 - l_bbox[1]),
                      label, fill=note_color, font=label_font)

    return staff_width


def _extract_quality(name):
    """Extract 'Major', 'Minor', etc. from triad name like 'C Major (...)'."""
    parts = name.split()
    if len(parts) >= 2:
        return parts[1]
    return "Major"


# ---------- title formatting ----------

STRING_TO_ORDINAL = {"e": "1st", "B": "2nd", "G": "3rd", "D": "4th", "A": "5th", "E": "6th"}


def _ordinal(n):
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    s = ["th", "st", "nd", "rd"]
    return str(n) + (s[n % 10] if n % 10 < 4 else "th")


def format_title(name):
    import re
    return re.sub(
        r"\(root fret (\d+), (\w) string\)",
        lambda m: f"({STRING_TO_ORDINAL[m.group(2)]} string, {_ordinal(int(m.group(1)))} fret)",
        name,
    )


# ---------- main renderer ----------

SS = 3  # supersample factor for anti-aliasing


def render_chord_diagram(triad, output_path):
    """Render a chord diagram PNG for the given triad data."""
    # Layout constants (at 1x, then scaled up for rendering)
    margin = 16
    tab_x = margin
    tab_y = 54
    tab_label_w = 70
    tab_total_w = TAB_LINE_LEFT + TAB_LINE_WIDTH + 12 + tab_label_w
    gap = 24
    staff_x = tab_x + tab_total_w + gap

    quality = _extract_quality(triad["name"])
    accidentals, _, _ = get_key_signature(triad["root"], quality)
    tab_height = (len(STRING_ORDER) - 1) * TAB_STRING_SPACING
    staff_scale = 0.50
    staff_height = tab_height * staff_scale
    line_spacing = staff_height / (STAFF_LINES - 1)
    clef_w = int(line_spacing * 3.2)
    acc_w = int(len(accidentals) * line_spacing * 0.55)
    staff_w = clef_w + acc_w + 28 + 30 + 16
    staff_label_w = 50

    img_w = staff_x + staff_w + 8 + staff_label_w + margin

    # Render at SS× resolution for anti-aliasing
    big = Image.new("RGB", (img_w * SS, IMG_H * SS), COLOR_BG)
    draw = ImageDraw.Draw(big)

    # Scaled fonts
    font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 17 * SS)
    title = format_title(triad["name"])
    draw.text((margin * SS, 12 * SS), title, fill=COLOR_FG, font=font_title)

    # Tab section
    draw_tab_section(draw, tab_x * SS, tab_y * SS, triad, SS)

    # Staff section
    staff_top_y = tab_y
    staff_bottom_y = tab_y + (len(STRING_ORDER) - 1) * TAB_STRING_SPACING * staff_scale
    draw_staff_section(draw, staff_x * SS, staff_top_y * SS, staff_bottom_y * SS, triad, SS)

    # Downsample with Lanczos
    img = big.resize((img_w, IMG_H), Image.LANCZOS)

    os.makedirs(output_path.parent, exist_ok=True)
    img.save(str(output_path), "PNG", optimize=True)
    return output_path


# ---------- CLI ----------

def filename_for_triad(triad):
    """Generate a filename from triad name."""
    import re
    name = triad["name"]
    # "C Major (root fret 3, A string)" -> "C_Major_root3_A"
    m = re.match(r"(.+?) \(root fret (\d+), (\w) string\)", name)
    if m:
        chord = m.group(1).replace(" ", "_").replace("#", "s")
        return f"{chord}_root{m.group(2)}_{m.group(3)}.png"
    return name.replace(" ", "_") + ".png"


if __name__ == "__main__":
    import json
    import sys

    triads_path = Path(__file__).resolve().parent.parent / "sent_triads.json"
    data = json.loads(triads_path.read_text())
    triads = data["available_triads"]

    print(f"Generating {len(triads)} chord diagrams...")
    for i, triad in enumerate(triads, 1):
        out = STATIC_DIR / filename_for_triad(triad)
        try:
            render_chord_diagram(triad, out)
        except Exception as e:
            print(f"  FAILED: {triad['name']}: {e}", file=sys.stderr)
            continue
        if i % 20 == 0 or i == len(triads):
            print(f"  {i}/{len(triads)} done")
    print(f"All diagrams saved to {STATIC_DIR}")
