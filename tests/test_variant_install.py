"""variant/install.sh against a pretend Fire TV: the guard swap, and the way back.

Run: python3 -m unittest discover -s tests -v

The script is copied into a temporary tree so that it finds an APK to install and the
repo's scripts/ next to it, and it runs against tests/fake_tv.py: no TV is touched.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
FORK_GUARD = 'tv.dumbtv.variant/io.freemytv.Guard'
OLD_GUARD = 'tv.dumbtv.home/tv.dumbtv.home.Guard'
LABELS = {
    FORK_GUARD: 'dumbtv home (variant) button',
    OLD_GUARD: 'dumbtv home button',
}


class VariantInstallTests(unittest.TestCase):
    def state(self, sdk=30, **settings):
        base = {
            'sdk': sdk,
            'packages': {'tv.dumbtv.home': {'system': False, 'enabled': True},
                         'tv.dumbtv.variant': {'system': False, 'enabled': True}},
            'settings': {
                'secure/enabled_accessibility_services': OLD_GUARD,
                'secure/accessibility_enabled': '1',
                'global/alarm_manager_constants': 'min_futurity=5000',
            },
            'accessibility_labels': LABELS,
        }
        base['settings'].update(settings)
        return base

    def run_install(self, state, *args):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / 'variant' / 'build').mkdir(parents=True)
            (tmp / 'variant' / 'build' / 'variant.apk').write_bytes(b'not an apk')
            shutil.copy(ROOT / 'variant' / 'install.sh', tmp / 'variant' / 'install.sh')
            (tmp / 'scripts').symlink_to(ROOT / 'scripts')
            state_file = tmp / 'state.json'
            state_file.write_text(json.dumps(state))
            log = tmp / 'commands.log'
            log.touch()
            env = dict(os.environ, ADB=str(ROOT / 'tests' / 'fake_tv.py'), ADB_SERIAL='test-tv',
                       FAKE_TV_STATE=str(state_file), FAKE_TV_LOG=str(log))
            result = subprocess.run(['bash', str(tmp / 'variant' / 'install.sh'), *args],
                                    env=env, capture_output=True, text=True, timeout=120)
            commands = log.read_text().splitlines()
            state = json.loads(state_file.read_text())
        return result, commands, state

    def test_the_fork_s_guard_replaces_the_old_launcher_s(self):
        result, _, state = self.run_install(self.state())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        enabled = state['settings']['secure/enabled_accessibility_services']
        self.assertIn(FORK_GUARD, enabled)
        self.assertNotIn(OLD_GUARD, enabled)

    def test_the_old_launcher_s_guard_is_the_only_one_out(self):
        # Two guards would fight over the HOME key.
        _, _, state = self.run_install(self.state())
        enabled = state['settings']['secure/enabled_accessibility_services']
        self.assertEqual(enabled.count('Guard'), 1)

    def test_other_accessibility_services_are_kept(self):
        _, _, state = self.run_install(
            self.state(**{'secure/enabled_accessibility_services': f'example.reader/.Service:{OLD_GUARD}'}))
        enabled = state['settings']['secure/enabled_accessibility_services']
        self.assertIn('example.reader/.Service', enabled)
        self.assertIn(FORK_GUARD, enabled)

    def test_the_accessibility_service_stays_enabled(self):
        _, _, state = self.run_install(self.state())
        self.assertEqual(state['settings']['secure/accessibility_enabled'], '1')

    def test_the_fork_is_not_made_a_home_app_candidate(self):
        # The Guard is the whole mechanism: a HOME category would let the package
        # manager hand the HOME key to the fork on its own.
        _, commands, _ = self.run_install(self.state())
        self.assertFalse([c for c in commands if 'set-home-activity' in c])
        self.assertFalse([c for c in commands if 'category.HOME' in c])

    def test_the_appops_are_set(self):
        # A fresh install elsewhere needs them; setting them again changes nothing.
        _, commands, _ = self.run_install(self.state())
        self.assertIn('appops set tv.dumbtv.variant SYSTEM_ALERT_WINDOW allow', commands)
        self.assertIn('appops set tv.dumbtv.variant REQUEST_INSTALL_PACKAGES allow', commands)

    def test_the_alarm_setting_the_guard_needs_is_set(self):
        # The Guard's launch goes through an alarm, and an alarm does not fire sooner
        # than five seconds from now unless min_futurity says otherwise.
        _, _, state = self.run_install(self.state())
        self.assertEqual(state['settings']['global/alarm_manager_constants'], 'min_futurity=0')

    def test_the_undo_puts_the_old_launcher_s_guard_back(self):
        # The rollback is one setting: the old launcher's guard goes back into
        # enabled_accessibility_services, and the fork's goes out.
        result, _, state = self.run_install(
            self.state(**{'secure/enabled_accessibility_services': FORK_GUARD}), '--undo')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        enabled = state['settings']['secure/enabled_accessibility_services']
        self.assertEqual(enabled, OLD_GUARD)

    def test_the_undo_keeps_the_fork_installed(self):
        # The way back to a working TV is not "uninstall the fork": the fork stays,
        # it is simply not in charge.
        result, _, state = self.run_install(
            self.state(**{'secure/enabled_accessibility_services': FORK_GUARD}), '--undo')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('tv.dumbtv.variant', state['packages'])

    def test_the_fork_needs_android_8(self):
        # Fire OS 6's Keeper, which is how the old launcher takes HOME there, is not
        # ours: on such a TV the old launcher stays the home screen.
        result, _, state = self.run_install(self.state(sdk=25))
        self.assertEqual(result.returncode, 1)
        self.assertIn('Android 8', result.stderr)
        self.assertEqual(state['settings']['secure/enabled_accessibility_services'], OLD_GUARD)

    def test_an_unknown_flag_is_refused(self):
        result, _, _ = self.run_install(self.state(), '--generik')
        self.assertEqual(result.returncode, 2)
        self.assertIn('usage:', result.stderr)


if __name__ == '__main__':
    unittest.main()
