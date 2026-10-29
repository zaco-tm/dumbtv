"""Regression checks for enabled-but-unbound services, entirely off-device.

There is one product now: the fork, tv.dumbtv.variant. The old launcher is the
fallback - it is not built or shipped from this repo any more, but it stays
installed on a television, so the checks still have to recognise it and say what
to do when it is in charge.
"""
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# The fallback launcher's label: the dump names a bound service by its label,
# never by its component.
LABEL = 'Service[label=dumbtv home button, feedbackType[FEEDBACK_GENERIC]]'
# The fork's guard has its own label on purpose: the dump names a bound service by
# its label, never by its component, and the two guards are never bound at once.
FORK_LABEL = 'Service[label=AverageTV guard, feedbackType[FEEDBACK_GENERIC]]'
FORK_GUARD = 'tv.dumbtv.variant/io.freemytv.Guard'
FORK_HOME = 'tv.dumbtv.variant/io.freemytv.HomeActivity'
OLD_GUARD = 'tv.dumbtv.home/tv.dumbtv.home.Guard'
OLD_HOME = 'tv.dumbtv.home/.Home'


class VerifyHarness(unittest.TestCase):
    """The pretend TV the checks run against. No test of its own."""

    BLOCKED = ['softwareupdates.amazon.com', 'arcus-uswest.amazon.com',
               'unagi-zaz.amazon.com', 'unagi-na.amazon.com']
    ALLOWED = ['www.youtube.com', 'i.ytimg.com',
               'appstore-tv-prod-na.amazon.com', 'm.media-amazon.com']

    def run_verify(self, dump, *, component=FORK_GUARD, enabled='1',
                   user='0', launcher='1', dump_code=0, sdk='34', futurity='0',
                   alarms='min_futurity=0',
                   landed=FORK_HOME,
                   away='com.amazon.tv.launcher/.ui.MainSettingsActivity',
                   dnsfilter='0', extra=None):
        # Android 14's shape (the fake reports sdk 34): a per-task topResumedActivity=,
        # and the top-level ResumedActivity: after the task list.
        def resumed(app):
            return ('  * Task{1 #5 type=standard A=10050:' + app.split('/')[0] + '}\n'
                    '      topResumedActivity=ActivityRecord{1 u0 ' + app + ' t5}\n'
                    '  ResumedActivity: ActivityRecord{1 u0 ' + app + ' t5}')
        replies = {
            'getprop ro.build.version.sdk': {'out': sdk},
            # Asked three times: what is in front now, what the check moved to, and
            # where HOME landed.
            'dumpsys activity activities': [
                {'out': resumed('example.player/.Main')},
                {'out': resumed(away)},
                {'out': resumed(landed)},
            ],
            'dumpsys power': {'out': 'mWakefulness=Awake'},
            'device_config get alarm_manager min_futurity': {'out': futurity},
            'settings get global alarm_manager_constants': {'out': alarms},
            'am get-current-user': {'out': user},
            f'settings --user {user} get secure enabled_accessibility_services': {'out': component},
            f'settings --user {user} get secure accessibility_enabled': {'out': enabled},
            'dumpsys accessibility': {'out': dump, 'code': dump_code},
            'pm list packages -d': {'out': ''},
            'settings get secure screensaver_components': {'out': 'null'},
            'am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_SETTINGS': {'out': ''},
            'input keyevent KEYCODE_HOME': {'out': ''},
        }
        if dnsfilter == '1':
            for h in self.BLOCKED:
                replies[f'ping -c1 -W2 {h}'] = {'out': f'ping: unknown host {h}'}
            for h in self.ALLOWED:
                replies[f'ping -c1 -W2 {h}'] = {'out': f'PING {h} (142.250.1.1) 56(84) bytes of data.'}
            replies.update({
                'pm path dnsfilter.android': {'out': 'package:/data/app/dnsfilter.android/base.apk'},
                'dumpsys package dnsfilter.android': {'out': '    userId=10251'},
                'dumpsys connectivity': {'out': 'NetworkAgentInfo{ ni{[type: VPN[], state: CONNECTED]} nc{[ Uid: 10251 OwnerUid: 10251 ]} }'},
                'ip addr show': {'out': '18: tun0: <POINTOPOINT,UP,LOWER_UP> mtu 1280'},
                'settings get secure always_on_vpn_app': {'out': 'null'},
                'grep -c . /sdcard/Android/data/dnsfilter.android/files/PersonalDNSFilter/FILTERHOSTS.TXT 2>/dev/null': {'out': '415'},
            })
        replies.update(extra or {})
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            data, log = tmp / 'responses.json', tmp / 'calls.jsonl'
            data.write_text(json.dumps(replies))
            env = dict(os.environ, ADB=str(ROOT / 'tests/fake_verify_adb.py'),
                       SERIAL='test-tv', CONF=str(tmp / 'absent.conf'),
                       DNSFILTER=dnsfilter, LAUNCHER=launcher, FAKE_ADB_LOG=str(log),
                       FAKE_ADB_RESPONSES=str(data))
            result = subprocess.run(['bash', str(ROOT / 'scripts/verify.sh')],
                                    env=env, text=True, capture_output=True)
            calls = [json.loads(line) for line in log.read_text().splitlines()]
        self.assertNotIn('unexpected command', result.stdout + result.stderr)
        # The fake refuses any command it has no reply for, so nothing else reaches a TV.
        return result, calls

    @staticmethod
    def modern(bound, user=0):
        return (f'User state[\n attributes:{{id={user}, flags=0}}\n'
                f' Bound services:{{{bound}}}\n Enabled services:{{{FORK_GUARD}}}\n'
                ' Binding services:{}\n]\n')


class VerifyTests(VerifyHarness):
    def test_bound_android14_while_another_app_is_foreground(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL))
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('bound, front is example.player/.Main', result.stdout)

    def test_a_disabled_screensaver_is_flagged(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), extra={
            'pm list packages -d': {'out': 'package:com.amazon.ftv.screensaver\npackage:com.amazon.tv.acr'},
            'settings get secure screensaver_components':
                {'out': 'com.amazon.ftv.screensaver/.app.services.ScreensaverService'},
        })
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('2 disabled', result.stdout)
        self.assertIn('com.amazon.ftv.screensaver is disabled, so the TV sleeps', result.stdout)

    def test_bound_android9_format(self):
        dump = f'User state[attributes:{{id=0, currentUser=true}}\n services:{{{FORK_LABEL}}}]'
        result, _ = self.run_verify(dump)
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_bound_android9_class_name_after_update(self):
        # Seen on a Fire OS 7 TV right after adb install -r: the label is not loaded yet.
        by_class = FORK_LABEL.replace('AverageTV guard', 'io.freemytv.Guard')
        dump = f'User state[attributes:{{id=0, currentUser=true}}\n services:{{{by_class}}}]'
        result, _ = self.run_verify(dump)
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_other_class_name_does_not_pass(self):
        other = FORK_LABEL.replace('AverageTV guard', 'io.freemytv.GuardX')
        dump = f'User state[attributes:{{id=0, currentUser=true}}\n services:{{{other}}}]'
        result, _ = self.run_verify(dump)
        self.assertEqual(result.returncode, 1)

    def test_enabled_but_unbound_is_failure(self):
        result, _ = self.run_verify(self.modern(''))
        self.assertEqual(result.returncode, 1)
        self.assertIn('enabled but not bound', result.stdout)

    def test_label_outside_bound_section_does_not_pass(self):
        result, _ = self.run_verify(self.modern('') + 'Binding services:{' + FORK_LABEL + '}')
        self.assertEqual(result.returncode, 1)

    def test_other_user_bound_does_not_pass(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL, 10) + self.modern(''))
        self.assertEqual(result.returncode, 1)

    def test_current_secondary_user_and_full_component(self):
        result, _ = self.run_verify(self.modern('', 0) + self.modern(FORK_LABEL, 10), user='10',
                                    component='example.reader/.Service:' + FORK_GUARD)
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_similar_labels_or_components_do_not_pass(self):
        # The label has to be ours and only ours: a label that merely looks like
        # ours is another service, and so is a component that merely looks like
        # ours.
        for dump, component in [(self.modern(FORK_LABEL.replace('guard,', 'guard fake,')),
                                 'tv.dumbtv.variant/.io.freemytv.Guard'),
                                (self.modern(FORK_LABEL), 'tv.dumbtv.variant.fake/io.freemytv.Guard')]:
            with self.subTest(component=component):
                result, _ = self.run_verify(dump, component=component)
                self.assertEqual(result.returncode, 1)

    def test_global_accessibility_disabled(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), enabled='0')
        self.assertEqual(result.returncode, 1)

    def test_failed_empty_unknown_or_truncated_dump(self):
        for dump, code in [('', 0), ('Permission denied', 0), (self.modern(FORK_LABEL), 1),
                           ('User state[\n attributes:{id=0, flags=0}\n Bound services:{' + FORK_LABEL, 0)]:
            with self.subTest(dump=dump):
                result, _ = self.run_verify(dump, dump_code=code)
                self.assertEqual(result.returncode, 1)
                self.assertIn('cannot verify accessibility binding', result.stdout)

    def test_unreadable_user_is_unknown(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), user='Error')
        self.assertEqual(result.returncode, 1)

    def test_launcher_opt_out_skips_binding_queries(self):
        result, calls = self.run_verify('', launcher='0')
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertFalse(any('accessibility' in ' '.join(c) for c in calls))

    def test_speed_requirement_is_preserved(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), futurity='null')
        self.assertEqual(result.returncode, 1)
        self.assertIn('min_futurity=0 missing', result.stdout)

    def test_android14_ignores_the_android11_alarm_setting(self):
        # Android 12+ reads min_futurity from DeviceConfig only (issue #57): the global
        # setting an older install wrote there must not pass the check.
        result, _ = self.run_verify(self.modern(FORK_LABEL), futurity='null', alarms='min_futurity=0')
        self.assertEqual(result.returncode, 1)
        self.assertIn('min_futurity=0 missing', result.stdout)

    def test_android12_is_the_first_to_read_device_config(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), sdk='31', futurity='null', alarms='min_futurity=0')
        self.assertEqual(result.returncode, 1)
        self.assertIn('min_futurity=0 missing', result.stdout)

    def test_android11_reads_the_global_alarm_setting(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), sdk='30', futurity='null',
                                    alarms='other=1,min_futurity=0')
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('ok         alarm', result.stdout)

    def test_a_futurity_that_only_starts_with_zero_is_not_zero(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL), sdk='30', alarms='min_futurity=05000')
        self.assertEqual(result.returncode, 1)

    def test_home_key_proves_the_takeover(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL))
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('ok         home-key', result.stdout)
        self.assertIn('HOME lands on ' + FORK_HOME, result.stdout)

    def test_home_key_on_another_launcher_is_a_failure(self):
        # The service can be bound and the alarm can fire while HOME stays on
        # Amazon's launcher, so the key itself is the only proof.
        result, _ = self.run_verify(self.modern(FORK_LABEL),
                                    landed='com.amazon.tv.launcher/.ui.HomeActivity_vNext')
        self.assertEqual(result.returncode, 1)
        self.assertIn('FAIL       home-key', result.stdout)

    def test_home_key_is_skipped_when_the_home_screen_cannot_be_left(self):
        # Nothing to prove: the check never got away from our own home.
        result, _ = self.run_verify(self.modern(FORK_LABEL), away=FORK_HOME)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('skip       home-key', result.stdout)

    def test_fire_os_6_is_skipped_because_the_fork_does_not_run_there(self):
        # The fork needs Android 8. On Fire OS 6 the old launcher is the home screen,
        # so there is nothing of ours to check and nothing to fail.
        result, _ = self.run_verify(self.modern(FORK_LABEL), sdk='25')
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('skip       home', result.stdout)

    def test_nxdomain_from_a_router_is_blocked(self):
        # Blocky and Unbound answer NXDOMAIN for a denylisted host where
        # personalDNSfilter answers 0.0.0.0; both mean the lookup was filtered.
        result, _ = self.run_verify(self.modern(FORK_LABEL), dnsfilter='1')
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('blocked (NXDOMAIN)', result.stdout)
        self.assertIn('ok         vpn', result.stdout)

    def test_nxdomain_from_a_dead_resolver_is_not_blocked(self):
        # If nothing resolves, "unknown host" proves the resolver is down, not
        # that the blocklist works, so it must not pass as blocked.
        dead = {f'ping -c1 -W2 {h}': {'out': f'ping: unknown host {h}'}
                for h in self.BLOCKED + self.ALLOWED}
        result, _ = self.run_verify(self.modern(FORK_LABEL), dnsfilter='1', extra=dead)
        self.assertEqual(result.returncode, 1)
        self.assertIn('no answer from the resolver', result.stdout)

    def test_public_address_is_still_not_blocked(self):
        resolving = {f'ping -c1 -W2 {h}': {'out': f'PING {h} (52.1.2.3) 56(84) bytes of data.'}
                     for h in self.BLOCKED}
        result, _ = self.run_verify(self.modern(FORK_LABEL), dnsfilter='1', extra=resolving)
        self.assertEqual(result.returncode, 1)
        self.assertIn('NOT BLOCKED', result.stdout)

    def test_another_vpns_tunnel_is_not_the_filter(self):
        # The owner's Surfshark tunnel was reported as personalDNSfilter before.
        result, _ = self.run_verify(self.modern(FORK_LABEL), dnsfilter='1',
                                    extra={'pm path dnsfilter.android': {'out': ''}})
        self.assertEqual(result.returncode, 1)
        self.assertIn('FAIL       vpn', result.stdout)
        self.assertIn('personalDNSfilter is not installed', result.stdout)
        self.assertNotIn('ok         vpn', result.stdout)


class FallbackTests(VerifyHarness):
    """The old launcher is the fallback: it works, but it is not this product."""

    def test_the_fallback_is_named_and_the_product_is_not_in_charge(self):
        result, _ = self.run_verify(self.modern(LABEL), component=OLD_GUARD, landed=OLD_HOME)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('the old launcher (fallback) is in charge', result.stdout)
        self.assertIn('re-run ./variant/install.sh', result.stdout)

    def test_the_fallback_still_gets_home_working(self):
        # The rollback has to leave a working TV, so HOME still lands on the fallback.
        result, _ = self.run_verify(self.modern(LABEL), component=OLD_GUARD, landed=OLD_HOME)
        self.assertIn('ok         home-key', result.stdout)
        self.assertIn('HOME lands on ' + OLD_HOME, result.stdout)

    def test_no_dumbtv_home_in_charge_is_a_failure(self):
        # Something else's accessibility service is enabled: no dumbtv home screen.
        result, _ = self.run_verify(self.modern(''), component='example.reader/.Service')
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('no AverageTV is in charge', result.stdout)

    def test_the_fork_s_guard_must_be_the_one_bound(self):
        # The setting names the fork's guard, but the fallback's service is the
        # one that is actually bound: the fork does not own HOME.
        result, _ = self.run_verify(self.modern(LABEL),
                                    component=FORK_GUARD,
                                    landed=FORK_HOME)
        self.assertEqual(result.returncode, 1)
        self.assertIn('AverageTV: enabled but not bound', result.stdout)

    def test_home_on_the_fallback_is_a_failure_for_the_fork(self):
        # The fork's guard is bound, but HOME still lands on the fallback.
        result, _ = self.run_verify(self.modern(FORK_LABEL),
                                    component=FORK_GUARD,
                                    landed=OLD_HOME)
        self.assertEqual(result.returncode, 1)
        self.assertIn('FAIL       home-key', result.stdout)

    def test_the_install_path_named_is_the_one_of_the_product(self):
        result, _ = self.run_verify(self.modern(FORK_LABEL),
                                    component=FORK_GUARD,
                                    landed=FORK_HOME,
                                    futurity='null', alarms='other=1', sdk='30')
        self.assertEqual(result.returncode, 1)
        self.assertIn('re-run ./variant/install.sh', result.stdout)


if __name__ == '__main__':
    unittest.main()
