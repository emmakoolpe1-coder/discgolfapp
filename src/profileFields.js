export function normalizeSkillLevel(v) {
  if (v === 'beginner' || v === 'intermediate' || v === 'advanced') return v;
  return undefined;
}

export function normalizeThrowStyle(v) {
  if (v === 'rhbh' || v === 'rhfh' || v === 'lhbh' || v === 'lhfh') return v;
  return undefined;
}

export function mergeFirestoreProfileIntoAuth(prev, data) {
  if (!prev) return null;

  const skillLevel = normalizeSkillLevel(data?.skillLevel);
  const throwStyle = normalizeThrowStyle(data?.throwStyle);

  return {
    ...prev,
    ...(skillLevel ? { skillLevel } : {}),
    // Missing legacy Firestore fields must not clobber an explicit local profile choice.
    ...(throwStyle ? { throwStyle } : {}),
  };
}
