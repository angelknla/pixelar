'use server';

import { saveItem } from '@/app/library-actions';
import { requireAccount } from '@/lib/data/library';
import { object, text } from '@/lib/validation';

export const saveReviewedImport = async (values: unknown) => {
  await requireAccount();

  if (!Array.isArray(values) || values.length > 200)
    return {
      saved: [] as string[],
      errors: [{ key: 'import', error: 'Import at most 200 titles at a time.' }],
    };

  const saved: string[] = [];

  const errors: { key: string; error: string }[] = [];

  const reviewed = values.map((value) => {
    const row = object(value);

    return { key: text(row.key, 100, true), item: row.item };
  });

  for (const row of reviewed) {
    const key = row.key;
    const result = await saveItem(row.item);

    if (result.error) errors.push({ key, error: result.error });
    else saved.push(key);
  }

  return { saved, errors };
};
