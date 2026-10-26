// Live-backend injection preflight (D2 §4, G1 wiring per owner-decisions-20261026).
// Pure presence-flag assessment. Takes booleans only: never secret values,
// never student identities, never network access.

import {isDateAdmitted, type OwnerAdmission} from './owner-admission.ts';

export interface InjectionPresence {
  hasFlockLock: boolean;
  hasRunner: boolean;
  hasDocker: boolean;
  hasImage: boolean;
  hasPinnedArtifacts: boolean;
  hasEnvGetterKey: boolean;
  scopeAdmitsDate: boolean;
  /** Optional G1 wiring: when lessonDate is present, the scope flag is
   * computed from the owner admission instead of the caller-supplied bit. */
  lessonDate?: string;
  admission?: OwnerAdmission | null;
}

export interface InjectionReadiness {
  ready: boolean;
  missing: string[];
}

const LINKS: Array<[keyof InjectionPresence, string]> = [
  ['hasFlockLock', 'account_lock_unavailable'],
  ['hasRunner', 'runner_unavailable'],
  ['hasDocker', 'container_runtime_unavailable'],
  ['hasImage', 'pinned_image_absent'],
  ['hasPinnedArtifacts', 'pinned_artifacts_absent'],
  ['hasEnvGetterKey', 'credential_getter_key_absent'],
  ['scopeAdmitsDate', 'lesson_date_out_of_admitted_scope'],
];

export function assessInjectionReadiness(
  presence: InjectionPresence,
): InjectionReadiness {
  const scopeOk = presence.lessonDate === undefined
    ? presence.scopeAdmitsDate
    : isDateAdmitted(presence.lessonDate, presence.admission ?? null);
  const missing = LINKS.filter(([key]) =>
    key === 'scopeAdmitsDate' ? !scopeOk : !presence[key],
  ).map(([, code]) => code);
  return { ready: missing.length === 0, missing };
}
