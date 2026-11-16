// SIA: the list of known quartiers, offered as suggestions while typing (native <datalist>).
import React from 'react';
import { QUARTIERS } from './quartiers';

export const QUARTIERS_LIST_ID = 'sia-quartiers';

export function SiaQuartierList() {
  return (
    <datalist id={QUARTIERS_LIST_ID}>
      {QUARTIERS.map((q) => (
        <option key={q} value={q} />
      ))}
    </datalist>
  );
}
