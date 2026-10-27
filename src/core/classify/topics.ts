/**
 * Topic vocabulary. Each topic has English keywords (matched on stemmed
 * tokens or phrases) and Arabic keywords (matched on normalized text).
 * Arabic entries are single common words/short roots — not religious texts.
 */

export interface TopicDefinition {
  slug: string;
  label: string;
  en: string[];
  ar: string[];
  /** Phrases describing a situation that point to this topic (used by search). */
  situations: string[];
}

export const TOPICS: readonly TopicDefinition[] = [
  {
    slug: "forgiveness",
    label: "Forgiveness",
    en: ["forgive", "forgiveness", "pardon", "mercy", "sin", "sins", "istighfar", "astaghfirullah"],
    ar: ["اغفر", "مغفره", "استغفر", "استغفرك", "ذنوبي", "ذنبي", "العفو", "فاعف", "عفوك", "ارحمني"],
    situations: ["regret", "guilt", "guilty", "mistake", "sinned", "ashamed", "messed up"],
  },
  {
    slug: "repentance",
    label: "Repentance",
    en: ["repent", "repentance", "tawbah", "tawba", "turn back"],
    ar: ["توبه", "تب علينا", "التواب", "اتوب"],
    situations: ["want to change", "start again", "come back to allah", "fresh start"],
  },
  {
    slug: "guidance",
    label: "Guidance",
    en: ["guide", "guidance", "straight path", "hidayah", "istikhara", "decision", "steadfast"],
    ar: ["اهدنا", "اهدني", "الهدى", "هدايه", "الصراط", "ثبت", "قلبي على دينك", "استخيرك"],
    situations: ["confused", "lost", "decision", "choose", "choice", "unsure", "doubt", "direction"],
  },
  {
    slug: "protection",
    label: "Protection",
    en: ["protect", "protection", "refuge", "evil", "harm", "shaytan", "satan", "evil eye", "safety"],
    ar: ["اعوذ", "اعوذ بك", "اعيذ", "شر", "الشيطان", "احفظني", "حفظ", "عافني"],
    situations: ["afraid", "scared", "fear", "danger", "nightmare", "evil eye", "unsafe", "jinn"],
  },
  {
    slug: "knowledge",
    label: "Knowledge",
    en: ["knowledge", "learn", "study", "understanding", "wisdom", "exam", "test", "school"],
    ar: ["علما", "علم", "زدني", "فهم", "حكمه", "اشرح لي صدري", "علمني"],
    situations: ["exam", "studying", "study", "test", "school", "university", "homework", "revision", "class"],
  },
  {
    slug: "success",
    label: "Success",
    en: ["success", "succeed", "rizq", "provision", "sustenance", "barakah", "job", "work", "ease"],
    ar: ["رزق", "ارزقني", "توفيق", "يسر", "بارك", "البركه", "فلاح"],
    situations: ["job", "interview", "career", "money", "debt", "business", "provision", "new job", "work"],
  },
  {
    slug: "family",
    label: "Family and Parents",
    en: ["parent", "parents", "mother", "father", "family", "children", "child", "spouse", "wife", "husband", "offspring"],
    ar: ["لوالدي", "والدي", "ارحمهما", "ذريتي", "ذريه", "ازواجنا", "اهلي"],
    situations: ["mum", "mom", "dad", "parents", "kids", "baby", "marriage", "married", "spouse", "family"],
  },
  {
    slug: "health",
    label: "Health and Healing",
    en: ["heal", "healing", "health", "sick", "sickness", "illness", "cure", "pain", "shifa"],
    ar: ["اشف", "الشافي", "شفاء", "عافيه", "العافيه", "مرض", "سقم"],
    situations: ["sick", "ill", "hospital", "pain", "surgery", "unwell", "recovery", "illness"],
  },
  {
    slug: "hardship",
    label: "Hardship",
    en: ["hardship", "difficulty", "distress", "anxiety", "grief", "sorrow", "worry", "burden", "trial", "test"],
    ar: ["الهم", "الحزن", "كرب", "عسر", "ضيق", "همي"],
    situations: [
      "overwhelmed", "anxious", "anxiety", "stressed", "stress", "sad", "depressed", "grief", "struggling",
      "hard time", "difficult", "worried", "heartbroken", "lonely", "exhausted", "tired", "panic",
    ],
  },
  {
    slug: "patience",
    label: "Patience (Sabr)",
    en: ["patience", "patient", "sabr", "persevere", "endure", "steadfast"],
    ar: ["صبر", "الصبر", "اصبر", "صبرا"],
    situations: ["waiting", "hard time", "struggling", "loss", "grief", "overwhelmed", "trial"],
  },
  {
    slug: "tawakkul",
    label: "Trust in Allah (Tawakkul)",
    en: ["tawakkul", "trust", "rely", "reliance", "plan", "qadr", "decree", "hasbunallah"],
    ar: ["توكلت", "توكل", "حسبنا", "حسبي", "قدر", "وكيل"],
    situations: ["trusting allah", "trust allah", "future", "worried", "uncertain", "overwhelmed", "anxious", "plans"],
  },
  {
    slug: "gratitude",
    label: "Gratitude",
    en: ["grateful", "gratitude", "thank", "thankful", "shukr", "blessing", "alhamdulillah", "praise"],
    ar: ["الحمد", "شكر", "اشكر", "نعمتك", "نعمه"],
    situations: ["happy", "blessed", "thankful", "good news", "grateful"],
  },
  {
    slug: "travel",
    label: "Travel",
    en: ["travel", "journey", "trip", "safar", "riding", "vehicle"],
    ar: ["سفر", "سفرنا", "سخر لنا", "مقرنين"],
    situations: ["travel", "trip", "flight", "flying", "driving", "journey", "holiday", "vacation", "car"],
  },
  {
    slug: "salah",
    label: "Salah",
    en: ["salah", "salat", "prayer", "pray", "namaz", "sujood", "khushu", "fajr", "isha", "tahajjud"],
    ar: ["الصلاه", "صلاه", "مقيم الصلاه", "سجود"],
    situations: ["prayer", "praying", "salah", "focus in prayer", "missed prayer"],
  },
  {
    slug: "character",
    label: "Character",
    en: ["character", "manners", "akhlaq", "kindness", "anger", "honesty", "humility", "arrogance", "tongue", "backbiting"],
    ar: ["اخلاق", "الاخلاق", "حسن الخلق", "الغضب"],
    situations: ["angry", "anger", "rude", "jealous", "jealousy", "patience with people", "kind"],
  },
  {
    slug: "morning",
    label: "Morning",
    en: ["morning", "sunrise", "fajr", "wake", "waking"],
    ar: ["اصبحنا", "اصبحت", "الصباح"],
    situations: ["morning", "waking up", "start of the day"],
  },
  {
    slug: "evening",
    label: "Evening",
    en: ["evening", "sunset", "maghrib", "night"],
    ar: ["امسينا", "امسيت", "المساء"],
    situations: ["evening", "night", "end of the day"],
  },
  {
    slug: "sleep",
    label: "Sleep",
    en: ["sleep", "sleeping", "bed", "bedtime"],
    ar: ["باسمك اللهم اموت", "نومي", "مضجعي", "النوم"],
    situations: ["sleep", "can't sleep", "insomnia", "bedtime", "nightmare"],
  },
  {
    slug: "after-salah",
    label: "After Salah",
    en: ["after salah", "after prayer", "after every prayer", "after salat", "post-prayer"],
    ar: ["دبر كل صلاه", "دبر الصلاه"],
    situations: ["after prayer"],
  },
  {
    slug: "death",
    label: "Death and the Hereafter",
    en: ["death", "grave", "akhirah", "hereafter", "jannah", "paradise", "hellfire", "janazah", "deceased"],
    ar: ["الموت", "القبر", "الاخره", "الجنه", "النار"],
    situations: ["someone died", "passed away", "funeral", "loss", "grieving"],
  },
  {
    slug: "ramadan",
    label: "Ramadan",
    en: ["ramadan", "fasting", "fast", "iftar", "suhoor", "laylatul qadr", "sawm"],
    ar: ["رمضان", "الصيام", "صوم", "ليله القدر"],
    situations: ["ramadan", "fasting", "iftar", "last ten nights"],
  },
];

export const TOPIC_BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

export function topicLabel(slug: string): string {
  return TOPIC_BY_SLUG.get(slug)?.label ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
