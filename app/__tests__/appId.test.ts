import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {APP_ID, JAVA_PACKAGE} from '../src/config';

const root = join(__dirname, '..');
const gradle = readFileSync(join(root, 'android', 'app', 'build.gradle'), 'utf8');
const manifest = readFileSync(
  join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
  'utf8',
);

test('the build uses the id the app says it does', () => {
  expect(gradle).toContain(`applicationId "${APP_ID}"`);
  expect(gradle).toContain(`namespace "${JAVA_PACKAGE}"`);
});

test('the launcher is the host activity, on a television', () => {
  expect(manifest).toContain('android:name=".HomeActivity"');
  expect(manifest).toContain('android.intent.category.LEANBACK_LAUNCHER');
  expect(manifest).toContain('android:screenOrientation="landscape"');
  expect(manifest).toContain('android:banner="@drawable/banner"');
});

test('the app does not ask for the home key', () => {
  expect(manifest).not.toContain('android.intent.category.HOME');
});
