import {
  MAX_MENTION_RESULTS,
  searchMentionParticipants,
} from './mention-search';

describe('searchMentionParticipants', () => {
  const participants = Array.from({ length: 1000 }, (_, index) => ({
    user_id: index,
    username: `member-${index}`,
  }));

  it('limits unfiltered participants to the maximum result count', () => {
    const results = searchMentionParticipants(participants, '');

    expect(results).toHaveLength(MAX_MENTION_RESULTS);
    expect(results[0]).toBe(participants[0]);
  });

  it('returns matching participants up to the maximum result count', () => {
    const results = searchMentionParticipants(participants, 'MEMBER-1');

    expect(results).toHaveLength(MAX_MENTION_RESULTS);
    expect(
      results.every(participant => participant.username?.includes('1')),
    ).toBe(true);
  });

  it('trims the query and returns no results when nothing matches', () => {
    expect(searchMentionParticipants(participants, '  missing  ')).toEqual([]);
  });
});
