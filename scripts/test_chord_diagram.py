"""Tests for chord_diagram.py."""

import os
from pathlib import Path

import pytest

from chord_diagram import (
    filename_for_triad,
    format_title,
    get_key_signature,
    get_written_pitch,
    note_to_staff_position,
    render_chord_diagram,
    STATIC_DIR,
)


# --- get_written_pitch ---

class TestGetWrittenPitch:
    def test_open_low_e(self):
        # Open low E string = E2 sounding, written E3
        note, octave = get_written_pitch("E", 0)
        assert note == "E"
        assert octave == 3

    def test_a_string_fret_3(self):
        # A string fret 3 = C3 sounding, written C4
        note, octave = get_written_pitch("A", 3)
        assert note == "C"
        assert octave == 4

    def test_d_string_fret_2(self):
        # D string fret 2 = E3 sounding, written E4
        note, octave = get_written_pitch("D", 2)
        assert note == "E"
        assert octave == 4

    def test_g_string_fret_0(self):
        # Open G string = G3 sounding, written G4
        note, octave = get_written_pitch("G", 0)
        assert note == "G"
        assert octave == 4

    def test_high_e_string_fret_0(self):
        # Open high e = E4 sounding, written E5
        note, octave = get_written_pitch("e", 0)
        assert note == "E"
        assert octave == 5

    def test_b_string_fret_1(self):
        # B string fret 1 = C4 sounding, written C5
        note, octave = get_written_pitch("B", 1)
        assert note == "C"
        assert octave == 5


# --- note_to_staff_position ---

class TestNoteToStaffPosition:
    def test_e4_bottom_line(self):
        assert note_to_staff_position("E", 4) == 0

    def test_g4_second_line(self):
        assert note_to_staff_position("G", 4) == 1

    def test_b4_middle_line(self):
        assert note_to_staff_position("B", 4) == 2

    def test_d5_fourth_line(self):
        assert note_to_staff_position("D", 5) == 3

    def test_f5_top_line(self):
        assert note_to_staff_position("F", 5) == 4

    def test_c4_below_staff(self):
        # C4 = one ledger line below = position -1
        assert note_to_staff_position("C", 4) == -1

    def test_f4_first_space(self):
        assert note_to_staff_position("F", 4) == 0.5

    def test_a4_second_space(self):
        assert note_to_staff_position("A", 4) == 1.5


# --- get_key_signature ---

class TestGetKeySignature:
    def test_c_major_no_accidentals(self):
        acc, pos, glyph = get_key_signature("C", "Major")
        assert acc == []

    def test_g_major_one_sharp(self):
        acc, pos, glyph = get_key_signature("G", "Major")
        assert acc == ["F#"]
        assert glyph == "\u266F"

    def test_f_major_one_flat(self):
        acc, pos, glyph = get_key_signature("F", "Major")
        assert acc == ["Bb"]
        assert glyph == "\u266D"

    def test_d_major_two_sharps(self):
        acc, _, _ = get_key_signature("D", "Major")
        assert acc == ["F#", "C#"]

    def test_bb_major_two_flats(self):
        acc, _, _ = get_key_signature("Bb", "Major")
        assert acc == ["Bb", "Eb"]

    def test_a_minor_uses_c_major(self):
        # A minor relative major = C major = no accidentals
        acc, _, _ = get_key_signature("A", "Minor")
        assert acc == []

    def test_e_minor_uses_g_major(self):
        acc, _, glyph = get_key_signature("E", "Minor")
        assert acc == ["F#"]

    def test_d_minor_uses_f_major(self):
        acc, _, glyph = get_key_signature("D", "Minor")
        assert acc == ["Bb"]


# --- format_title ---

class TestFormatTitle:
    def test_basic(self):
        result = format_title("C Major (root fret 3, A string)")
        assert result == "C Major (5th string, 3rd fret)"

    def test_high_e(self):
        result = format_title("E Minor (root fret 12, e string)")
        assert result == "E Minor (1st string, 12th fret)"


# --- filename_for_triad ---

class TestFilenameForTriad:
    def test_c_major(self):
        t = {"name": "C Major (root fret 3, A string)"}
        assert filename_for_triad(t) == "C_Major_root3_A.png"

    def test_f_sharp(self):
        t = {"name": "F# Minor (root fret 9, A string)"}
        assert filename_for_triad(t) == "Fs_Minor_root9_A.png"


# --- render_chord_diagram (integration) ---

class TestRenderChordDiagram:
    def test_generates_png(self, tmp_path):
        triad = {
            "name": "C Major (root fret 3, A string)",
            "root": "C",
            "chord_tones": {"3": "E", "5": "G", "R": "C"},
            "strings": {"E": -1, "A": 3, "D": 2, "G": 0, "B": -1, "e": -1},
        }
        out = tmp_path / "test.png"
        render_chord_diagram(triad, out)
        assert out.exists()
        assert out.stat().st_size > 0

    def test_image_dimensions(self, tmp_path):
        from PIL import Image
        from chord_diagram import IMG_H

        triad = {
            "name": "C Major (root fret 3, A string)",
            "root": "C",
            "chord_tones": {"3": "E", "5": "G", "R": "C"},
            "strings": {"E": -1, "A": 3, "D": 2, "G": 0, "B": -1, "e": -1},
        }
        out = tmp_path / "test.png"
        render_chord_diagram(triad, out)
        img = Image.open(out)
        w, h = img.size
        assert h == IMG_H
        assert w > 0
