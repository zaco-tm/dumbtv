"""The variant's config.properties -> io.freemytv.Config generator, off-device."""
import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'variant' / 'tools' / 'gen_config.py'

FIELDS = ['TMDB_KEY', 'WATCHMODE_KEY', 'TMDB_REGION', 'LATITUDE', 'LONGITUDE', 'CITY',
          'LANGUAGE', 'CURRENCY', 'TEMPERATURE', 'HIDE_SERVICES', 'THEME',
          'DISABLE_ASSISTANT', 'SHOW_CRYPTO', 'HIDE_ANIMATION', 'SCREENSAVER', 'GENERIC']


def load_tool():
    spec = importlib.util.spec_from_file_location('gen_config', TOOL)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def generate(properties, *, generic=False):
    """Run the tool and return the generated Java."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'Config.java'
        args = [sys.executable, str(TOOL)]
        if generic:
            args.append('--generic')
        else:
            props = Path(tmp) / 'config.properties'
            props.write_text(properties, encoding='utf-8')
            args.append(str(props))
        args.append(str(out))
        done = subprocess.run(args, capture_output=True, text=True)
        if done.returncode != 0:
            raise AssertionError(done.stderr.strip())
        return out.read_text(encoding='utf-8')


class VariantConfigTests(unittest.TestCase):
    def test_generic_leaves_the_location_empty(self):
        java = generate('', generic=True)
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_generic_takes_the_other_defaults(self):
        java = generate('', generic=True)
        self.assertIn('static final String TMDB_KEY = "";', java)
        self.assertIn('static final String LANGUAGE = "auto";', java)
        self.assertIn('static final String TEMPERATURE = "auto";', java)
        self.assertIn('static final String THEME = "auto";', java)
        self.assertIn('static final boolean SHOW_CRYPTO = true;', java)
        self.assertIn('static final boolean SCREENSAVER = true;', java)
        self.assertIn('static final boolean GENERIC = true;', java)

    def test_reads_the_values(self):
        java = generate('tmdb_key=abc123\ncity=Amsterdam\ntmdb_region=NL\n'
                        'latitude=52.37\nlongitude=4.89\ncurrency=EUR\n')
        self.assertIn('static final String TMDB_KEY = "abc123";', java)
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_REGION = "NL";', java)
        self.assertIn('static final String LATITUDE = "52.37";', java)
        self.assertIn('static final String LONGITUDE = "4.89";', java)
        self.assertIn('static final String CURRENCY = "EUR";', java)

    def test_the_last_value_wins(self):
        java = generate('city=First\ncity=Second\n')
        self.assertIn('static final String CITY = "Second";', java)

    def test_quotes_and_backslashes_are_stripped(self):
        java = generate('tmdb_key="quoted"\n')
        self.assertIn('static final String TMDB_KEY = "quoted";', java)

    def test_booleans_follow_upstream(self):
        java = generate('disable_assistant=true\nshow_crypto=false\n'
                        'hide_animation=true\nscreensaver=false\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = true;', java)
        self.assertIn('static final boolean SHOW_CRYPTO = false;', java)
        self.assertIn('static final boolean HIDE_ANIMATION = true;', java)
        self.assertIn('static final boolean SCREENSAVER = false;', java)

    def test_a_word_that_is_not_true_is_not_true(self):
        java = generate('disable_assistant=yes\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = false;', java)

    def test_a_word_that_is_not_false_is_not_false(self):
        java = generate('screensaver=maybe\n')
        self.assertIn('static final boolean SCREENSAVER = true;', java)

    def test_a_latitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError):
            generate('latitude=52,37\n')

    def test_every_field_upstream_reads_is_there(self):
        java = generate('', generic=True)
        for field in FIELDS:
            self.assertIn(field, java)

    def test_the_class_is_in_upstreams_package(self):
        java = generate('', generic=True)
        self.assertIn('package io.freemytv;', java)
        self.assertIn('final class Config {', java)


if __name__ == '__main__':
    unittest.main()
