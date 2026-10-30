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
  // The id is a property now, so that the swap can build the shipping id without touching the
  // file: the default is still the preview id the app says it is.
  expect(gradle).toContain('applicationId tvApplicationId');
  expect(gradle).toContain(
    `(project.findProperty("tvApplicationId") ?: "${APP_ID}")`,
  );
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
