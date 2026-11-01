/**
 * The hand-off to OpenTV, held against the native side's own contract.
 *
 * OpenTV plays the channels; AverageTV holds the guide. The one thing that must not go
 * wrong is the hand-off: OpenTV's channel ids are rows in its own private database, and
 * this app cannot know one. The provider's id for the same channel is a *different*
 * number, and sending it as OpenTV's would make OpenTV play whichever channel happens
 * to carry that number in its own list — the wrong channel, with nothing to say so.
 *
 * So the name goes and no id does. That is proved here, on the JavaScript side, because
 * this is the side that decides what to hand over.
 */
import {NativeModules} from 'react-native';
import {iptv} from '../src/native';

const watch = jest.fn().mockResolvedValue(true);

beforeEach(() => {
  watch.mockClear();
  (NativeModules as Record<string, unknown>).iptv = {watch};
});

test('the hand-off carries the name', async () => {
  await iptv.watch('BBC One');
  expect(watch).toHaveBeenCalledTimes(1);
  expect(watch).toHaveBeenCalledWith('BBC One');
});

test('the hand-off carries no id', async () => {
  await iptv.watch('BBC One');
  const args = watch.mock.calls[0] as unknown[];
  // One argument only: there is no id to send, so there is no place for one.
  expect(args).toHaveLength(1);
});
