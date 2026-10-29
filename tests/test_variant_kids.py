"""The kids face (the port of suboss87/my-kids-tv): the catalogue, the PIN, the mode.

Off-device: the assets, the licence and the attribution are read from the tree, and
the code is checked for the wiring the port promises. Nothing here touches a TV.
"""
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VARIANT = ROOT / 'variant'
SRC = VARIANT / 'src/io/freemytv'
CATALOG = VARIANT / 'assets/catalog'
DATA = VARIANT / 'catalog-data'
TOOL = VARIANT / 'tools/gen_config.py'

# The three bands the catalogue has, and how many titles each has.
BANDS = {'4-6': 106, '7-10': 372, '11-13': 453}


def read(name):
    return (SRC / name).read_text()


def method(text, signature):
    """The body of one method in a Java source, as text.

    `signature` is the method's declaration up to its arguments, so a call to the
    method elsewhere does not bring its body in.
    """
    start = text.index(signature + '(')
    open_brace = text.index('{', start)
    depth = 0
    for i in range(open_brace, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[open_brace:i + 1]
    raise AssertionError(f'{signature} has no closing brace')


class CatalogTests(unittest.TestCase):
    """The three band files the app reads, and the open dataset beside them."""

    def test_every_band_is_there(self):
        for band in BANDS:
            self.assertTrue((CATALOG / f'{band}.json').is_file(), f'{band}.json is missing')

    def test_the_bands_hold_their_titles(self):
        for band, count in BANDS.items():
            data = json.loads((CATALOG / f'{band}.json').read_text())
            self.assertEqual(data['band'], band)
            self.assertEqual(len(data['titles']), count, f'{band} has the wrong number of titles')

    def test_the_catalogue_holds_931_titles(self):
        total = sum(len(json.loads((CATALOG / f'{band}.json').read_text())['titles']) for band in BANDS)
        self.assertEqual(total, 931)

    def test_every_title_is_judged_for_its_age(self):
        """Each row is a title judged for that age: a kind, a TMDB id, a score, a badge."""
        for band in BANDS:
            for title in json.loads((CATALOG / f'{band}.json').read_text())['titles']:
                self.assertIn(title['kind'], ('movie', 'tv'))
                self.assertIsInstance(title['id'], int)
                self.assertTrue(title['title'])
                self.assertIn(title.get('badge', ''), ('', 'must', 'learn', 'loved'))
                self.assertGreaterEqual(title.get('score', 0), 0)

    def test_the_links_name_the_services_the_app_knows(self):
        """The links name the service keys; the app turns them into the apps it may show."""
        services = set(re.findall(r'\{"[^"]+", "([a-z0-9]+)",', read('Recs.java')))
        self.assertTrue(services, 'the service table is not in Recs.java')
        for band in BANDS:
            for title in json.loads((CATALOG / f'{band}.json').read_text())['titles']:
                for key in (title.get('links') or {}):
                    self.assertIn(key, services, f'{key} is not a service the app knows')

    def test_the_open_dataset_is_shipped_with_its_licence(self):
        self.assertTrue((DATA / 'LICENSE').is_file())
        self.assertTrue((DATA / 'kids-titles.csv').is_file())
        self.assertTrue((DATA / 'kids-titles.json').is_file())
        for band in BANDS:
            self.assertTrue((DATA / f'{band}.csv').is_file())

    def test_the_licence_is_next_to_the_data_the_app_reads(self):
        self.assertTrue((CATALOG / 'LICENSE').is_file())

    def test_the_dataset_is_credited_as_my_kids_tv_under_cc_by_4(self):
        """The curation is CC BY 4.0: it is credited as "My Kids TV", with the licence and a
        note that changes were made. Both the notice and the upstream note must say it."""
        for path in (ROOT / 'NOTICE', VARIANT / 'UPSTREAM.md'):
            text = path.read_text()
            self.assertIn('My Kids TV', text, f'{path} does not credit My Kids TV')
            self.assertIn('creativecommons.org/licenses/by/4.0', text,
                          f'{path} does not link the CC BY 4.0 licence')
            self.assertTrue(re.search(r'changes (were|have been) made', text, re.I),
                            f'{path} does not say that changes were made')


class ConfigTests(unittest.TestCase):
    """The parent's PIN, the age band and the child's name come from config.properties."""

    def generate(self, properties):
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text(properties)
            out = Path(tmp) / 'Config.java'
            done = subprocess.run([sys.executable, str(TOOL), str(props), str(out)],
                                  capture_output=True, text=True)
            self.assertEqual(done.returncode, 0, done.stderr)
            return out.read_text()

    def test_the_defaults(self):
        java = self.generate('')
        self.assertIn('static final String PARENT_PIN = "";', java)
        self.assertIn('static final String AGE_BAND = "7-10";', java)
        self.assertIn('static final String CHILD_NAME = "";', java)

    def test_the_values_are_read(self):
        java = self.generate('parent_pin=1234\nage_band=4-6\nchild_name=Viva\n')
        self.assertIn('static final String PARENT_PIN = "1234";', java)
        self.assertIn('static final String AGE_BAND = "4-6";', java)
        self.assertIn('static final String CHILD_NAME = "Viva";', java)

    def test_the_example_file_documents_them(self):
        text = (VARIANT / 'config.example.properties').read_text()
        for key in ('parent_pin', 'age_band', 'child_name'):
            self.assertIn(key, text, f'{key} is not in config.example.properties')


class WiringTests(unittest.TestCase):
    """The port's promises, as they are in the code."""

    def test_the_pin_is_a_salted_hash_and_never_the_pin(self):
        prefs = read('Prefs.java')
        self.assertIn('hashPin', prefs)
        self.assertIn('MessageDigest', prefs)
        self.assertNotIn('putString("pin", pin)', prefs)

    def test_the_pin_lives_in_a_file_of_its_own(self):
        """The settings file is written from more than one process: a copy that never had
        the PIN must not be able to take it away. The PIN is written with commit(), so it
        is on the disk before anyone is let in."""
        prefs = read('Prefs.java')
        self.assertIn('getSharedPreferences("parent_pin"', prefs)
        self.assertIn('putString("pin", hashPin(pin)).commit()', prefs)
        self.assertNotIn('sp().getString("pin"', prefs)

    def test_the_pin_waits_thirty_seconds_after_five_tries(self):
        lock = read('ParentLock.java')
        self.assertIn('TRIES = 5', lock)
        self.assertIn('WAIT = 30_000', lock)
        self.assertIn('pinWaitUntil', lock)

    def test_the_wait_is_kept_in_the_prefs(self):
        """Closing and opening the settings again must not reset the wait."""
        prefs = read('Prefs.java')
        self.assertIn('pinWaitUntil', prefs)
        self.assertIn('setPinFails', prefs)

    def test_the_three_bands_are_the_catalogue_s(self):
        prefs = read('Prefs.java')
        self.assertIn('AGE_BANDS = {"4-6", "7-10", "11-13"}', prefs)

    def test_the_kids_settings_live_in_a_file_of_their_own(self):
        """The settings file is written from more than one process: a copy that never had
        the band must not be able to take it away. The kids settings (the band, the child's
        name and the mode) live in their own file, written only by :home, and with commit(),
        so they are on the disk before the screen that shows them is drawn."""
        prefs = read('Prefs.java')
        self.assertIn('getSharedPreferences("kids_settings"', prefs)
        self.assertIn('putString("age_band", v).commit()', prefs)
        self.assertIn('putBoolean("kidsMode", on).commit()', prefs)
        self.assertIn('putString("child_name", v).commit()', prefs)
        # The shared settings file must not be where they are written.
        self.assertNotIn('put("age_band"', prefs)
        self.assertNotIn('put("child_name"', prefs)
        self.assertNotIn('sp().edit().putBoolean("kidsMode"', prefs)

    def test_the_old_kids_settings_are_moved_once(self):
        """A build that kept them in the settings file must not lose the parent's choice
        when it is updated: the values are copied over once, in :home."""
        prefs = read('Prefs.java')
        migrate = method(prefs, 'static void migrateKids')
        self.assertIn('"age_band"', migrate)
        self.assertIn('"child_name"', migrate)
        self.assertIn('"kidsMode"', migrate)
        self.assertIn('commit()', migrate)
        # The migration is the one writer's job: the home screen's process.
        for name in ('HomeActivity.java', 'SettingsActivity.java'):
            self.assertIn('Prefs.migrateKids()', read(name), f'{name} does not migrate the kids settings')

    def test_the_kids_settings_survive_another_process_writing(self):
        """The other processes (the sleep timer, the screensaver) write the shared settings
        file; the kids settings are not in it, so they cannot be taken away."""
        prefs = read('Prefs.java')
        kids = method(prefs, 'static String ageBand')
        self.assertIn('kidsSp()', kids)
        self.assertIn('kidsSp()', method(prefs, 'static boolean kidsMode'))
        self.assertIn('kidsSp()', method(prefs, 'static String childName'))

    def test_the_kids_button_is_always_there(self):
        """The parent's PIN locks the kids face, so the way in cannot be switched off."""
        apps = read('HomeApps.java')
        self.assertIn('kidsButton()', apps)
        self.assertIn('MAX_TOP = TOP_DEFAULT.size() + 1', apps)

    def test_the_apps_are_hidden_in_the_kids_mode(self):
        apps = read('HomeApps.java')
        self.assertIn('kidsHidden', apps)
        self.assertIn('Prefs.kidsMode()', apps)

    def test_the_shelf_the_kids_face_draws_is_filtered(self):
        """The shelf is the way a child reaches an app, so the kids face must not show
        the adult ones there either (the All Apps sheet was already filtered)."""
        apps = read('HomeApps.java')
        self.assertIn('kidsHidden', method(apps, 'static List<Item> shelf'))
        self.assertIn('kidsHidden', method(apps, 'static List<Item> others'))

    def test_the_two_faces_have_their_own_picks(self):
        """The normal face's TMDB list must not show in the kids face, and the vetted
        catalogue must not show on the normal face."""
        recs = read('Recs.java')
        self.assertIn('mode()', method(recs, 'private long sourceStamp'))
        # A face switch clears the other face's picks, so an adult title is never on
        # the kids face while the vetted list is on its way.
        refresh = method(recs, 'void refreshIfStale')
        self.assertIn('listMode', refresh)
        self.assertIn('picks = new ArrayList<>()', refresh)

    def test_each_fetch_records_the_face_it_belongs_to(self):
        recs = read('Recs.java')
        self.assertIn('listMode = "kids"', recs)
        self.assertIn('listMode = "normal"', recs)

    def test_the_normal_face_keeps_its_own_picks(self):
        """The normal face is upstream's: its picks come from TMDB, three per hour."""
        recs = read('Recs.java')
        self.assertIn('fetchTmdbList', recs)
        self.assertIn('/trending/', recs)
        self.assertIn('if (Prefs.kidsMode()) return at(', recs)

    def test_the_kids_button_is_one_press_from_home(self):
        """The owner asked to reach the kids face in one or two presses from HOME: the
        normal face opens with the focus on the Kids button, so HOME then OK is it."""
        home = read('HomeView.java')
        self.assertIn('KIDS_TOP = 3', home)     # the first round button: the Kids one
        reset = method(home, 'void reset')
        self.assertIn('zone = Z_TOP', reset)
        self.assertIn('topIndex = KIDS_TOP', reset)

    def test_the_kids_face_is_its_own_view(self):
        """The two faces coexist: the normal one is upstream's HomeView, the kids one is
        my-kids-tv's, ported."""
        kids = read('KidsView.java')
        self.assertIn('final class KidsView', kids)
        self.assertIn('SpaceSky', kids)
        self.assertIn('greeting()', kids)
        self.assertNotIn('My Kids TV', kids, "the other product's name is still in the UI")
        self.assertNotIn('MyKidsTV', kids)

    def test_no_other_products_name_is_left_in_the_tree(self):
        for path in SRC.glob('*.java'):
            text = path.read_text()
            self.assertNotIn('io.mykidstv', text, f'{path.name} still uses their package')
            self.assertNotIn('My Kids TV', text, f'{path.name} still says My Kids TV')

    def test_the_space_sky_is_ported(self):
        sky = read('SpaceSky.java')
        self.assertIn('final class SpaceSky', sky)

    def test_the_parent_lock_is_ported(self):
        lock = read('ParentLock.java')
        self.assertIn('final class ParentLock', lock)
        self.assertIn('KEYCODE_NUMPAD_0', lock, 'the keypad has to work without number keys')

    def test_the_manifest_is_unchanged(self):
        """No new component and no new permission: the port needed none."""
        text = (VARIANT / 'AndroidManifest.xml').read_text()
        self.assertNotIn('io.freemytv.KidsView', text)
        self.assertNotIn('io.freemytv.ParentLock', text)
        self.assertNotIn('io.freemytv.SpaceSky', text)


class VendorListTests(unittest.TestCase):
    """The vendor proof: the new files are ours, and the changed ones are listed."""

    def listed(self, name):
        text = (VARIANT / name).read_text()
        return [line.strip() for line in text.splitlines() if line.strip()]

    def test_the_new_files_are_ours(self):
        ours = self.listed('our-files.txt')
        for path in ('src/io/freemytv/KidsView.java', 'src/io/freemytv/ParentLock.java',
                     'src/io/freemytv/SpaceSky.java', 'assets/catalog/4-6.json',
                     'assets/catalog/7-10.json', 'assets/catalog/11-13.json',
                     'assets/catalog/LICENSE'):
            self.assertIn(path, ours, f'{path} is not in our-files.txt')

    def test_the_changed_files_are_listed(self):
        changed = self.listed('local-changes.txt')
        for path in ('src/io/freemytv/Prefs.java', 'src/io/freemytv/Recs.java',
                     'src/io/freemytv/SettingsActivity.java', 'src/io/freemytv/HomeApps.java',
                     'src/io/freemytv/HomeView.java', 'src/io/freemytv/HomeActivity.java',
                     'src/io/freemytv/Backdrop.java', 'src/io/freemytv/Click.java',
                     'src/io/freemytv/Shadows.java', 'src/io/freemytv/Spoken.java'):
            self.assertIn(path, changed, f'{path} is not in local-changes.txt')


if __name__ == '__main__':
    unittest.main()
