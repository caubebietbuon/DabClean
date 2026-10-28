'use strict';

// Contrastive descriptions include high-density orderly rooms and low-density disorder.
// These are hypotheses, not labels or ground truth. CLIP cannot ground small stains.
const GROUPS = {
  scene: [
    ['room', 'an indoor living room with furniture'], ['room', 'an indoor bedroom'],
    ['room', 'an indoor kitchen with counters'], ['room', 'an indoor office with desks and shelves'],
    ['room', 'an indoor bathroom with a visible floor'],
    ['other', 'a close up portrait of a person'], ['other', 'a landscape outdoors'],
    ['other', 'a screenshot of text on a computer screen'], ['other', 'a close up of food on a plate']
  ],
  clutter: [
    ['clear', 'a room full of books and decorations neatly organized on shelves, with clear walkways'],
    ['clear', 'a maximalist room with many colorful decorations arranged neatly and an unobstructed floor'],
    ['clear', 'an organized workspace with documents and tools in use on the desk'],
    ['clear', 'a sparsely furnished tidy room with a clear floor'],
    ['concern', 'a sparsely furnished room with clothes and bottles scattered across the floor blocking the walkway'],
    ['concern', 'a disorganized room with possessions thrown in piles obstructing walking paths'],
    ['uncertain', 'a room with toys being used on the floor, unclear whether temporarily in use or abandoned']
  ],
  litter: [
    ['clear', 'a room with books toys and decorations stored neatly, no visible discarded rubbish'],
    ['concern', 'discarded food wrappers and crumpled paper scattered on the room floor'],
    ['uncertain', 'toys and working papers being used, not clearly discarded rubbish'],
    ['unobservable', 'a room floor hidden behind furniture and not visible']
  ],
  dust: [
    ['clear', 'a close view of a clean shelf surface without visible dust'],
    ['concern', 'a close view of a thick visible layer of dust on a shelf surface'],
    ['uncertain', 'a patterned or weathered surface whose texture could be mistaken for dust'],
    ['unobservable', 'a distant room photograph with no close detail of surface dust']
  ],
  stains: [
    ['clear', 'a visible clean floor and counters without obvious stains'],
    ['concern', 'visible spilled liquid stains and greasy marks on the floor and counters'],
    ['uncertain', 'shadows and decorative patterns on a floor, unclear whether stained'],
    ['unobservable', 'surfaces not visible in enough detail to see stains']
  ],
  floor: [
    ['clear', 'a visible clean floor, furniture and decorations arranged neatly'],
    ['concern', 'a visible floor with dirt and spilled liquid stains even though the room is nearly empty'],
    ['uncertain', 'a patterned floor with shadows but no clear evidence of dirt'],
    ['unobservable', 'the floor is hidden and cannot be inspected']
  ],
  surfaces: [
    ['clear', 'clean visible tables and shelves with many neatly placed decorations'],
    ['concern', 'tabletops and counters with visible greasy spills and dirty residue'],
    ['uncertain', 'an old textured table surface with no clear evidence of dirty residue'],
    ['unobservable', 'table and shelf surfaces are obscured or too far away to inspect']
  ]
};
const PROMPT_VERSION = 'context-contrast-v1';
module.exports = { GROUPS, PROMPT_VERSION };
