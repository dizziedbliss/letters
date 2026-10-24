// Fake data for `npm run demo`: two people, letters both ways, built intro pages.
// Never imported in production (see lib/supabase.ts).

export const MAX = '00000000-0000-4000-8000-00000000000a';
export const SAUMI = '00000000-0000-4000-8000-00000000000b';

export const USERS = [
  { id: MAX, email: 'max@demo', password: 'max' },
  { id: SAUMI, email: 'saumi@demo', password: 'saumi' },
];

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

const day = 86400e3;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const p = (text: string, styles: Row = {}) => ({ type: 'text', text, styles });
const para = (...content: Row[]) => ({ type: 'paragraph', content });

/** A few BlockNote bodies with real formatting, so the reader shows off. */
const BODIES: Record<string, Row[]> = {
  night: [
    { type: 'heading', props: { level: 2 }, content: 'hi you' },
    para(p('remember when we stayed up till '), p('4am', { bold: true, textColor: 'purple' }), p(' talking about absolutely nothing?')),
    para(p('i still think about it when i cant sleep.')),
    { type: 'bulletListItem', content: 'your laugh at 3:40am' },
    { type: 'bulletListItem', content: 'the stupid cat video' },
    { type: 'bulletListItem', content: 'you falling asleep mid sentence' },
    { type: 'quote', content: 'i miss you more than i say' },
  ],
  first: [
    para(p('okay so this is the first letter on our very own website hehe')),
    { type: 'image', props: { url: 'asset:characters', previewWidth: 300 } },
    para(p('it took me '), p('forever', { italic: true }), p(' but look, its ours.')),
  ],
  random: [para(p('no reason. just thinking about you :3'))],
  sick: [
    { type: 'heading', props: { level: 3 }, content: 'drink water. now.' },
    para(p('and then lie down and imagine im there annoying you')),
    { type: 'checkListItem', props: { checked: false }, content: 'water' },
    { type: 'checkListItem', props: { checked: false }, content: 'medicine' },
    { type: 'checkListItem', props: { checked: false }, content: 'text me' },
  ],
  sad: [para(p('come here. '), p('virtual hug', { bold: true }), p(' incoming. its okay to be sad, i got you.'))],
  sleep: [para(p('close your eyes and count how many times i said i love you today. you wont finish.'))],
  sealed: [para(p('surprise!! you opened the sealed one. heres a secret: ', {}), p('i practiced saying hi to you in the mirror once', { italic: true }))],
  generic: [para(p('a little letter, just for you.'))],
};

export function seed(): Tables {
  let id = 1;
  const letters: Row[] = [];
  const bodies: Row[] = [];
  const opens: Row[] = [];

  const add = (author: string, l: Row, body: Row[], openedDaysAgo?: number) => {
    const letter = {
      id: id++,
      author_id: author,
      title: '',
      body: '',
      section: 'random',
      sealed: false,
      greeting: '',
      rule: null,
      unlocked_by_writer: false,
      group_id: null,
      created_at: iso(-(25 - id) * day),
      updated_at: iso(-(25 - id) * day),
      published_at: iso(-(25 - id) * day),
      ...l,
    };
    letters.push(letter);
    bodies.push({ letter_id: letter.id, doc: body, updated_at: letter.updated_at });
    if (openedDaysAgo != null) {
      opens.push({ reader_id: author === MAX ? SAUMI : MAX, letter_id: letter.id, opened_at: iso(-openedDaysAgo * day) });
    }
    return letter.id;
  };

  // Each person gets the same spread, written by the other
  for (const [author, name] of [
    [SAUMI, 'Saumi'],
    [MAX, 'Max'],
  ] as const) {
    const first = add(author, { title: 'the night we stayed up', greeting: 'hi you,' }, BODIES.night);
    add(author, { title: 'secret one', sealed: true }, BODIES.sealed);
    add(author, { title: 'for your exam day', rule: { kind: 'date', at: iso(2 * day + 4 * 3600e3) } }, BODIES.generic);
    add(author, { title: 'chapter two', rule: { kind: 'after', letter_id: first } }, BODIES.generic);
    add(author, { title: `when ${name.toLowerCase()} is on call`, rule: { kind: 'manual' } }, BODIES.generic);
    add(author, { title: 'first one ever', greeting: 'hiii,' }, BODIES.first, 9); // read last week, so this week's quota starts fresh
    add(author, { title: 'random hehe' }, BODIES.random, 11);
    add(author, { title: 'sick', section: 'open_when' }, BODIES.sick);
    add(author, { title: 'sad', section: 'open_when' }, BODIES.sad);
    add(author, { title: "can't sleep", section: 'open_when' }, BODIES.sleep);
  }

  // Default groups per writer, and letters assigned to them
  const groups: Row[] = [];
  let gid = 1;
  for (const owner of [MAX, SAUMI]) {
    groups.push({ id: gid++, owner_id: owner, name: 'Random', quota: 4, period: 'week', default_for: 'random', created_at: iso(-30 * day) });
    groups.push({ id: gid++, owner_id: owner, name: 'Open when', quota: 2, period: 'week', default_for: 'open_when', created_at: iso(-30 * day) });
  }
  for (const l of letters) {
    l.group_id = groups.find((g) => g.owner_id === l.author_id && g.default_for === l.section)!.id;
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const herPage = {
    version: 1,
    background: { kind: 'preset', value: 'dark' },
    stickers: [],
    blocks: [
      { id: 'greeting', type: 'heading', props: { text: 'Hello, ', accent: 'Saumiiiiii' } },
      { id: 'intro', type: 'text', props: { size: 'md', text: 'This thing is currently under construction lol, apparently the owner of this website is currently doing something totally useless, uhm please forgive him... since he has done this much— he’ll be updating this soon.\n\nplease be in touch <3' } },
      { id: 'aside', type: 'text', props: { size: 'sm', text: 'until then u can read these :3' } },
      { id: 'letters-button', type: 'button', props: { label: 'This :3', color: 'cyan' } },
      { id: 'characters', type: 'image', props: { src: 'asset:characters', width: 0.62, align: 'center' } },
    ],
  };
  const maxPage = {
    version: 1,
    background: { kind: 'preset', value: 'purple' },
    stickers: [],
    blocks: [
      { id: 'g', type: 'heading', props: { text: 'Hiii ', accent: 'Maxxx', size: 'xl' } },
      { id: 't', type: 'text', props: { size: 'lg', italic: true, text: 'you made me a whole website so i made you a page hehe' } },
      { id: 't2', type: 'text', props: { size: 'md', text: 'theres letters in here. some are locked. no peeking >:3\n\nopen the sick ones only when ur actually sick okay??' } },
      { id: 'letters-button', type: 'button', props: { label: 'read em ♡', color: 'white', align: 'center' } },
    ],
  };

  return {
    profiles: [
      { id: MAX, display_name: 'Max', timezone: tz },
      { id: SAUMI, display_name: 'Saumi', timezone: tz },
    ],
    letters,
    letter_bodies: bodies,
    letter_opens: opens,
    letter_groups: groups,
    intros: [
      { for_user: SAUMI, nickname: 'Saumiiiiii', intro: '', aside: '', note: 'ILOVEYOUUUU' },
      { for_user: MAX, nickname: 'Maxxx', intro: '', aside: '', note: '' },
    ],
    intro_pages: [
      { for_user: SAUMI, doc: herPage, updated_by: MAX, published_at: iso(-3 * day) },
      { for_user: MAX, doc: maxPage, updated_by: SAUMI, published_at: iso(-1 * day) },
    ],
    intro_drafts: [
      { for_user: SAUMI, doc: herPage, updated_at: iso(-3 * day) },
      { for_user: MAX, doc: maxPage, updated_at: iso(-1 * day) },
    ],
  };
}
