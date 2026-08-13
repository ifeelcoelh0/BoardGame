const EMOTE_EVENT = Object.freeze({
  feliz: "emote_happy",
  rir: "emote_laugh",
  gozar: "emote_smug",
  zangado: "emote_angry",
  chocado: "emote_shocked",
  chorar: "emote_cry",
  suplica: "emote_plead",
  provocar: "emote_taunt",
});

const VOICE_VARIANTS = Object.freeze({
  found_village: 2,
  found_palace: 2,
  longest_road: 2,
  largest_army: 2,
  victory: 2,
  robbed: 2,
  trade_done: 2,
  emote_happy: 1,
  emote_laugh: 1,
  emote_smug: 1,
  emote_angry: 1,
  emote_shocked: 1,
  emote_cry: 1,
  emote_plead: 1,
  emote_taunt: 1,
});

export const CHARACTER_VOICE_PLAY_EVENT = "rdd:character-voice";
export const VOICE_EVENTS = Object.freeze(Object.keys(VOICE_VARIANTS));

export const VOICE_CHARACTERS = Object.freeze([
  "maria", "vlad", "romeo", "protheus", "makuru", "artheria", "muriel", "bones",
]);

const VOICE_TRANSCRIPTS = Object.freeze({
  maria: Object.freeze({
    found_village: Object.freeze(["A new jewel for the crown.", "Build it pretty, please."]),
    found_palace: Object.freeze(["Every princess needs a palace.", "Gold does suit me."]),
    longest_road: Object.freeze(["All roads lead to my door.", "A princess must be reachable."]),
    largest_army: Object.freeze(["For the kingdom and the light!", "Even light carries a sword."]),
    victory: Object.freeze(["The light always wins!", "Was there ever any doubt?"]),
    robbed: Object.freeze(["How dare you!", "I'll remember this. Vividly."]),
    trade_done: Object.freeze(["A pleasure doing business.", "See? Diplomacy."]),
    emote_happy: Object.freeze(["What a glorious day!"]),
    emote_laugh: Object.freeze(["Hehe! Adorable."]),
    emote_smug: Object.freeze(["Darling, that's precious."]),
    emote_angry: Object.freeze(["This will not stand!"]),
    emote_shocked: Object.freeze(["Light preserve me!"]),
    emote_cry: Object.freeze(["A princess doesn't cry. Much."]),
    emote_plead: Object.freeze(["Please, have a heart!"]),
    emote_taunt: Object.freeze(["The light fears no one!"]),
  }),
  vlad: Object.freeze({
    found_village: Object.freeze(["More land beneath my shadow.", "Let it never see the sun."]),
    found_palace: Object.freeze(["Let it rise, and let it loom.", "A throne suits the dark."]),
    longest_road: Object.freeze(["Every road leads to me now.", "The kingdom walks where I permit."]),
    largest_army: Object.freeze(["They march because they fear.", "My legions do not tire."]),
    victory: Object.freeze(["It was always inevitable.", "The night keeps what it takes."]),
    robbed: Object.freeze(["You will regret that hand.", "Take it. I will take more."]),
    trade_done: Object.freeze(["A fair bargain. For now.", "Our interests align. Briefly."]),
    emote_happy: Object.freeze(["The darkness smiles tonight."]),
    emote_laugh: Object.freeze(["Ha. Pathetic mortals."]),
    emote_smug: Object.freeze(["You call that a kingdom?"]),
    emote_angry: Object.freeze(["You will pay in blood."]),
    emote_shocked: Object.freeze(["That should not be possible."]),
    emote_cry: Object.freeze(["Even the immortal grieve."]),
    emote_plead: Object.freeze(["Spare me. For now."]),
    emote_taunt: Object.freeze(["Come. Face the dark."]),
  }),
  romeo: Object.freeze({
    found_village: Object.freeze(["Told you I'd get here first!", "Watch me build an empire."]),
    found_palace: Object.freeze(["A palace. At my age!", "Not bad for a boy, eh?"]),
    longest_road: Object.freeze(["Fastest legs in the kingdom!", "Try catching me now."]),
    largest_army: Object.freeze(["Biggest army, smallest king.", "Who's the kid now?"]),
    victory: Object.freeze(["I won! I actually won!", "Someone tell my mother."]),
    robbed: Object.freeze(["Hey! That's not fair!", "Pick on someone your own size!"]),
    trade_done: Object.freeze(["Nice one! Wait, was it?", "See, I can negotiate."]),
    emote_happy: Object.freeze(["Yes! Just as planned!"]),
    emote_laugh: Object.freeze(["Hahaha, did you see that?"]),
    emote_smug: Object.freeze(["I did that when I was five."]),
    emote_angry: Object.freeze(["That's not fair!"]),
    emote_shocked: Object.freeze(["Whoa. Didn't see that."]),
    emote_cry: Object.freeze(["I'm not crying. It's dust."]),
    emote_plead: Object.freeze(["Come on, I'm just a kid!"]),
    emote_taunt: Object.freeze(["Catch me if you can!"]),
  }),
  protheus: Object.freeze({
    found_village: Object.freeze(["A village! Now, where's the kitchen?", "Put the tavern in the middle."]),
    found_palace: Object.freeze(["Big enough for a proper feast.", "I'll need a bigger chair."]),
    longest_road: Object.freeze(["In my day we had horses, not roads.", "Longest road, shortest patience."]),
    largest_army: Object.freeze(["An army marches on its stomach. Mine especially.", "I was a soldier once. Briefly."]),
    victory: Object.freeze(["Bring wine! All of it!", "Victory tastes like supper."]),
    robbed: Object.freeze(["Thief! Scoundrel! What did they take?", "Someone write this down!"]),
    trade_done: Object.freeze(["A toast to commerce!", "In my day we shook on it. And drank."]),
    emote_happy: Object.freeze(["This calls for a feast!"]),
    emote_laugh: Object.freeze(["Hahaha! I'm choking."]),
    emote_smug: Object.freeze(["We did it better in my day."]),
    emote_angry: Object.freeze(["More wine! And vengeance!"]),
    emote_shocked: Object.freeze(["I nearly fell off the throne!"]),
    emote_cry: Object.freeze(["Nothing a drink won't fix. Probably."]),
    emote_plead: Object.freeze(["Pity an old king!"]),
    emote_taunt: Object.freeze(["Come here! I was good at this once!"]),
  }),
  makuru: Object.freeze({
    found_village: Object.freeze(["Makuru claims this. Nobody saw.", "Cosy. And nobody's counting."]),
    found_palace: Object.freeze(["Too shiny. Makuru likes it.", "Now Makuru is respectable."]),
    longest_road: Object.freeze(["Every road is Makuru's road.", "More ways in. More ways out."]),
    largest_army: Object.freeze(["Makuru pays well. Sometimes.", "Many blades. Few questions."]),
    victory: Object.freeze(["Makuru wins. Makuru always wins.", "Count your things. Go on."]),
    robbed: Object.freeze(["Nobody steals from Makuru.", "Makuru weeps. Makuru remembers."]),
    trade_done: Object.freeze(["Hehe. A pleasure, friend.", "Makuru is generous today."]),
    emote_happy: Object.freeze(["Hehehe. All according to plan."]),
    emote_laugh: Object.freeze(["Kheh kheh kheh!"]),
    emote_smug: Object.freeze(["Fools. All of you, fools."]),
    emote_angry: Object.freeze(["Nobody tricks Makuru."]),
    emote_shocked: Object.freeze(["My things! I mean, the things!"]),
    emote_cry: Object.freeze(["So few treasures left."]),
    emote_plead: Object.freeze(["Makuru is innocent, I swear."]),
    emote_taunt: Object.freeze(["Come, if you don't fear goblins."]),
  }),
  artheria: Object.freeze({
    found_village: Object.freeze(["The grove permits it.", "Roots first. Walls later."]),
    found_palace: Object.freeze(["Stone endures. So do we.", "Tall. The trees are taller."]),
    longest_road: Object.freeze(["The paths answer to the woods.", "I walk further than you look."]),
    largest_army: Object.freeze(["The woods send their own.", "Every arrow knows its name."]),
    victory: Object.freeze(["The forest remembers this day.", "Patience wins. It always did."]),
    robbed: Object.freeze(["The woods saw that.", "Take it. It was never yours."]),
    trade_done: Object.freeze(["The exchange is balanced.", "Give and take, as the seasons do."]),
    emote_happy: Object.freeze(["The forest celebrates with us."]),
    emote_laugh: Object.freeze(["Even the trees are laughing."]),
    emote_smug: Object.freeze(["Predictable as the wind."]),
    emote_angry: Object.freeze(["You've woken the groves."]),
    emote_shocked: Object.freeze(["Not even the spirits saw this."]),
    emote_cry: Object.freeze(["The leaves fall for me."]),
    emote_plead: Object.freeze(["Let nature soften your heart."]),
    emote_taunt: Object.freeze(["My arrow knows your name."]),
  }),
  muriel: Object.freeze({
    found_village: Object.freeze(["The stars marked this spot.", "I saw this in the smoke."]),
    found_palace: Object.freeze(["A tower worthy of the arcane.", "Now the visions have a window."]),
    longest_road: Object.freeze(["Every path bends to my will.", "I chose the route. Naturally."]),
    largest_army: Object.freeze(["They serve the arcane, not me.", "Summoned, not recruited."]),
    victory: Object.freeze(["The spell held. Mostly.", "The cards said so. I merely read them."]),
    robbed: Object.freeze(["You've cursed yourself now.", "I'll take that back. Later."]),
    trade_done: Object.freeze(["The stars approve this exchange.", "A fine trade. For one of us."]),
    emote_happy: Object.freeze(["The stars align!"]),
    emote_laugh: Object.freeze(["Ahaha. Deliciously tragic."]),
    emote_smug: Object.freeze(["I read your future. It's thin."]),
    emote_angry: Object.freeze(["I'll turn you into a toad!"]),
    emote_shocked: Object.freeze(["This was not in the cards!"]),
    emote_cry: Object.freeze(["Not even magic mends this."]),
    emote_plead: Object.freeze(["Mercy. The arcane rewards you."]),
    emote_taunt: Object.freeze(["Defy me and meet the arcane!"]),
  }),
  bones: Object.freeze({
    found_village: Object.freeze(["Another place not to sleep.", "It'll do."]),
    found_palace: Object.freeze(["Too big. Fine.", "Room for the whole family. They're dead."]),
    longest_road: Object.freeze(["Long walk. I have time.", "I've been further. Downward."]),
    largest_army: Object.freeze(["They were dead anyway.", "Loyal. Quiet. Ideal."]),
    victory: Object.freeze(["Worth coming back for.", "Told you I had time."]),
    robbed: Object.freeze(["That's fine. I own nothing.", "Bold. You'll keep."]),
    trade_done: Object.freeze(["Done.", "Acceptable."]),
    emote_happy: Object.freeze(["I feel alive. Ironic."]),
    emote_laugh: Object.freeze(["That's the closest I get."]),
    emote_smug: Object.freeze(["I've seen better. And I was dead."]),
    emote_angry: Object.freeze(["I'll gnaw your foundations."]),
    emote_shocked: Object.freeze(["Nearly lost my head. Again."]),
    emote_cry: Object.freeze(["No tears. Literally."]),
    emote_plead: Object.freeze(["Mercy. I've suffered enough."]),
    emote_taunt: Object.freeze(["You can't kill what's already dead."]),
  }),
});

export function emoteVoiceEvent(emoteKey) {
  return EMOTE_EVENT[emoteKey] || null;
}

export function voiceVariantCount(event) {
  return VOICE_VARIANTS[event] || 0;
}

export function pickVoiceVariant(event, random = Math.random) {
  const count = voiceVariantCount(event);
  if (!count) return null;
  if (count === 1) return 1;
  const sample = Number(random?.());
  const normalized = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999999, sample)) : 0;
  return Math.floor(normalized * count) + 1;
}

export function voiceTranscript(character, event, variant = 1) {
  const lines = VOICE_TRANSCRIPTS[character]?.[event];
  const index = Number(variant) - 1;
  return Array.isArray(lines) && Number.isInteger(index) && index >= 0 ? (lines[index] || "") : "";
}

export function voiceSoundKey(character, event) {
  if (!VOICE_CHARACTERS.includes(character) || !VOICE_VARIANTS[event]) return null;
  return `voice_event_${character}_${event}`;
}

export function createCharacterVoiceSoundMap(baseUrl) {
  const root = String(baseUrl || "").replace(/\/?$/, "/");
  const result = {};
  for (const character of VOICE_CHARACTERS) {
    for (const [event, count] of Object.entries(VOICE_VARIANTS)) {
      const key = voiceSoundKey(character, event);
      result[key] = Array.from({ length: count }, (_, index) => {
        const suffix = event.startsWith("emote_") ? "" : `_${String(index + 1).padStart(2, "0")}`;
        return `${root}${character}/${character}_${event}${suffix}.m4a`;
      });
    }
  }
  return result;
}

export const TROOP_CARD_SOUND_KEYS = Object.freeze({
  cavaleiro: "troopCardKnight",
  arqueiro: "troopCardArcher",
  catapulta: "troopCardCatapult",
});

export function createTroopCardSoundMap(baseUrl) {
  const root = String(baseUrl || "").replace(/\/?$/, "/");
  return {
    troopCardKnightHorse: [`${root}knight-horse.m4a`],
    troopCardKnightSword1: [`${root}knight-sword-1.m4a`],
    troopCardKnightSword2: [`${root}knight-sword-2.m4a`],
    troopCardKnightSword3: [`${root}knight-sword-3.m4a`],
    troopCardArcher: [`${root}archer-card.m4a`],
    troopCardCatapult: [`${root}catapult-card.m4a`],
  };
}
