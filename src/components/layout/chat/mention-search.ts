export const MAX_MENTION_RESULTS = 15;

interface MentionSearchParticipant {
  username?: string | null;
}

export function searchMentionParticipants<T extends MentionSearchParticipant>(
  participants: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  const results: T[] = [];

  for (const participant of participants) {
    const username = String(participant.username || '').toLowerCase();
    if (normalizedQuery && !username.includes(normalizedQuery)) {
      continue;
    }

    results.push(participant);
    if (results.length === MAX_MENTION_RESULTS) {
      break;
    }
  }

  return results;
}
