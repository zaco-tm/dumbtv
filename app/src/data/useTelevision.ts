import {useEffect, useState} from 'react';
import {loadApps, loadInputs, splitApps} from './tv';
import type {HomeInput, TvApp} from '../native';

/**
 * The television's own lists, read from the native side.
 *
 * The reading is here because three pages want it and none of them should have to know
 * how it happens. A list that cannot be read is an empty list: the page shows what it
 * has rather than an error the household would have to read across a room.
 */

/** The television's apps, split into the two pages they belong on. */
export function useApps(): {streaming: TvApp[]; games: TvApp[]} {
  const [apps, setApps] = useState<TvApp[]>([]);
  useEffect(() => {
    let alive = true;
    loadApps()
      .then(found => {
        if (alive) {
          setApps(found);
        }
      })
      .catch((e: unknown) => {
        console.warn('the apps could not be read:', e);
      });
    return () => {
      alive = false;
    };
  }, []);
  return splitApps(apps);
}

/** The television's inputs. */
export function useInputs(): HomeInput[] {
  const [inputs, setInputs] = useState<HomeInput[]>([]);
  useEffect(() => {
    let alive = true;
    loadInputs()
      .then(found => {
        if (alive) {
          setInputs(found);
        }
      })
      .catch((e: unknown) => {
        console.warn('the inputs could not be read:', e);
      });
    return () => {
      alive = false;
    };
  }, []);
  return inputs;
}
